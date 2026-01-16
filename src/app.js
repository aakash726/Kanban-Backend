const express = require('express');
const cors = require('cors');
const pool = require('./db/pool');

const app = express();
app.use(cors());
app.use(express.json());

// Get all boards
app.get('/api/boards', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM boards ORDER BY id');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching boards' });
  }
});

// Create a board
app.post('/api/boards', async (req, res) => {
  const { title } = req.body;
  if (!title) return res.status(400).json({ message: 'Title is required' });
  try {
    const [result] = await pool.query('INSERT INTO boards (title) VALUES (?)', [title]);
    const [boardRows] = await pool.query('SELECT * FROM boards WHERE id = ?', [result.insertId]);
    res.status(201).json(boardRows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error creating board' });
  }
});

// Get single board with lists and cards (and nested details)
app.get('/api/boards/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [boards] = await pool.query('SELECT * FROM boards WHERE id = ?', [id]);
    if (boards.length === 0) return res.status(404).json({ message: 'Board not found' });

    const [lists] = await pool.query('SELECT * FROM lists WHERE board_id = ? ORDER BY position', [id]);
    const [cards] = await pool.query('SELECT * FROM cards WHERE list_id IN (SELECT id FROM lists WHERE board_id = ?) AND archived = 0 ORDER BY position', [id]);

    const [labels] = await pool.query('SELECT * FROM labels WHERE board_id = ?', [id]);
    const [cardLabels] = await pool.query('SELECT * FROM card_labels');
    const [checklists] = await pool.query('SELECT * FROM checklists');
    const [checklistItems] = await pool.query('SELECT * FROM checklist_items');
    const [cardMembers] = await pool.query('SELECT * FROM card_members');
    const [users] = await pool.query('SELECT * FROM users');

    const listsWithCards = lists.map((list) => ({
      ...list,
      cards: cards
        .filter((card) => card.list_id === list.id)
        .map((card) => ({
          ...card,
          labels: cardLabels
            .filter((cl) => cl.card_id === card.id)
            .map((cl) => labels.find((l) => l.id === cl.label_id)),
          checklists: checklists
            .filter((ch) => ch.card_id === card.id)
            .map((ch) => ({
              ...ch,
              items: checklistItems.filter((it) => it.checklist_id === ch.id),
            })),
          members: cardMembers
            .filter((cm) => cm.card_id === card.id)
            .map((cm) => users.find((u) => u.id === cm.user_id)),
        })),
    }));

    res.json({
      board: boards[0],
      lists: listsWithCards,
      labels,
      users,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching board' });
  }
});

// List CRUD
app.post('/api/boards/:boardId/lists', async (req, res) => {
  const { boardId } = req.params;
  const { title } = req.body;
  if (!title) return res.status(400).json({ message: 'Title is required' });
  try {
    const [[{ maxPos }]] = await pool.query('SELECT COALESCE(MAX(position), 0) AS maxPos FROM lists WHERE board_id = ?', [boardId]);
    const [result] = await pool.query('INSERT INTO lists (board_id, title, position) VALUES (?, ?, ?)', [boardId, title, maxPos + 1]);
    const [rows] = await pool.query('SELECT * FROM lists WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error creating list' });
  }
});

app.put('/api/lists/:id', async (req, res) => {
  const { id } = req.params;
  const { title } = req.body;
  try {
    await pool.query('UPDATE lists SET title = ? WHERE id = ?', [title, id]);
    const [rows] = await pool.query('SELECT * FROM lists WHERE id = ?', [id]);
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error updating list' });
  }
});

app.delete('/api/lists/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM lists WHERE id = ?', [id]);
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error deleting list' });
  }
});

// Cards CRUD and movement
app.post('/api/lists/:listId/cards', async (req, res) => {
  const { listId } = req.params;
  const { title } = req.body;
  if (!title) return res.status(400).json({ message: 'Title is required' });
  try {
    const [[{ maxPos }]] = await pool.query('SELECT COALESCE(MAX(position), 0) AS maxPos FROM cards WHERE list_id = ?', [listId]);
    const [result] = await pool.query(
      'INSERT INTO cards (list_id, title, position) VALUES (?, ?, ?)',
      [listId, title, maxPos + 1]
    );
    const [rows] = await pool.query('SELECT * FROM cards WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error creating card' });
  }
});

app.put('/api/cards/:id', async (req, res) => {
  const { id } = req.params;
  const { title, description, due_date, archived } = req.body;
  try {
    await pool.query(
      'UPDATE cards SET title = ?, description = ?, due_date = ?, archived = COALESCE(?, archived) WHERE id = ?',
      [title, description, due_date, archived, id]
    );
    const [rows] = await pool.query('SELECT * FROM cards WHERE id = ?', [id]);
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error updating card' });
  }
});

app.delete('/api/cards/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM cards WHERE id = ?', [id]);
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error deleting card' });
  }
});

// Move / reorder cards and lists
app.post('/api/lists/reorder', async (req, res) => {
  const { listOrder } = req.body; // [{id, position}, ...]
  if (!Array.isArray(listOrder)) return res.status(400).json({ message: 'listOrder must be an array' });
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (const item of listOrder) {
      await conn.query('UPDATE lists SET position = ? WHERE id = ?', [item.position, item.id]);
    }
    await conn.commit();
    res.status(204).end();
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ message: 'Error reordering lists' });
  } finally {
    conn.release();
  }
});

app.post('/api/cards/reorder', async (req, res) => {
  const { cardOrder } = req.body; // [{id, list_id, position}, ...]
  if (!Array.isArray(cardOrder)) return res.status(400).json({ message: 'cardOrder must be an array' });
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (const item of cardOrder) {
      await conn.query('UPDATE cards SET list_id = ?, position = ? WHERE id = ?', [item.list_id, item.position, item.id]);
    }
    await conn.commit();
    res.status(204).end();
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ message: 'Error reordering cards' });
  } finally {
    conn.release();
  }
});

// Labels on cards
app.post('/api/cards/:cardId/labels/:labelId', async (req, res) => {
  const { cardId, labelId } = req.params;
  try {
    await pool.query('INSERT INTO card_labels (card_id, label_id) VALUES (?, ?)', [cardId, labelId]);
    res.status(201).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error adding label to card' });
  }
});

app.delete('/api/cards/:cardId/labels/:labelId', async (req, res) => {
  const { cardId, labelId } = req.params;
  try {
    await pool.query('DELETE FROM card_labels WHERE card_id = ? AND label_id = ?', [cardId, labelId]);
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error removing label from card' });
  }
});

// Checklist items
app.post('/api/cards/:cardId/checklists', async (req, res) => {
  const { cardId } = req.params;
  const { title } = req.body;
  if (!title) return res.status(400).json({ message: 'Title is required' });
  try {
    const [result] = await pool.query('INSERT INTO checklists (card_id, title) VALUES (?, ?)', [cardId, title]);
    const [rows] = await pool.query('SELECT * FROM checklists WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error creating checklist' });
  }
});

app.post('/api/checklists/:checklistId/items', async (req, res) => {
  const { checklistId } = req.params;
  const { title } = req.body;
  if (!title) return res.status(400).json({ message: 'Title is required' });
  try {
    const [[{ maxPos }]] = await pool.query('SELECT COALESCE(MAX(position), 0) AS maxPos FROM checklist_items WHERE checklist_id = ?', [checklistId]);
    const [result] = await pool.query(
      'INSERT INTO checklist_items (checklist_id, title, position) VALUES (?, ?, ?)',
      [checklistId, title, maxPos + 1]
    );
    const [rows] = await pool.query('SELECT * FROM checklist_items WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error creating checklist item' });
  }
});

app.put('/api/checklist-items/:id', async (req, res) => {
  const { id } = req.params;
  const { title, is_complete, position } = req.body;
  try {
    await pool.query(
      'UPDATE checklist_items SET title = COALESCE(?, title), is_complete = COALESCE(?, is_complete), position = COALESCE(?, position) WHERE id = ?',
      [title, is_complete, position, id]
    );
    const [rows] = await pool.query('SELECT * FROM checklist_items WHERE id = ?', [id]);
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error updating checklist item' });
  }
});

app.delete('/api/checklist-items/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM checklist_items WHERE id = ?', [id]);
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error deleting checklist item' });
  }
});

// Card members
app.post('/api/cards/:cardId/members/:userId', async (req, res) => {
  const { cardId, userId } = req.params;
  try {
    await pool.query('INSERT INTO card_members (card_id, user_id) VALUES (?, ?)', [cardId, userId]);
    res.status(201).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error assigning member to card' });
  }
});

app.delete('/api/cards/:cardId/members/:userId', async (req, res) => {
  const { cardId, userId } = req.params;
  try {
    await pool.query('DELETE FROM card_members WHERE card_id = ? AND user_id = ?', [cardId, userId]);
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error removing member from card' });
  }
});

// Search and filter cards within a board
app.get('/api/boards/:boardId/search', async (req, res) => {
  const { boardId } = req.params;
  const { q, labelId, memberId, dueBefore, dueAfter } = req.query;

  try {
    let query =
      'SELECT c.* FROM cards c JOIN lists l ON c.list_id = l.id WHERE l.board_id = ? AND c.archived = 0';
    const params = [boardId];

    if (q) {
      query += ' AND c.title LIKE ?';
      params.push(`%${q}%`);
    }
    if (labelId) {
      query += ' AND EXISTS (SELECT 1 FROM card_labels cl WHERE cl.card_id = c.id AND cl.label_id = ?)';
      params.push(labelId);
    }
    if (memberId) {
      query += ' AND EXISTS (SELECT 1 FROM card_members cm WHERE cm.card_id = c.id AND cm.user_id = ?)';
      params.push(memberId);
    }
    if (dueBefore) {
      query += ' AND c.due_date <= ?';
      params.push(dueBefore);
    }
    if (dueAfter) {
      query += ' AND c.due_date >= ?';
      params.push(dueAfter);
    }

    query += ' ORDER BY c.due_date IS NULL, c.due_date';

    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error searching cards' });
  }
});

// Basic root endpoint
app.get('/', (req, res) => {
  res.json({ status: 'ok' });
});

module.exports = app;
