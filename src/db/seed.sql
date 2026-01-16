-- Seed data for Trello-like Kanban app

INSERT INTO users (name, email) VALUES
 ('Alice Johnson', 'alice@example.com'),
 ('Bob Smith', 'bob@example.com'),
 ('Charlie Brown', 'charlie@example.com');

INSERT INTO boards (title) VALUES ('Sample Project Board');

INSERT INTO board_members (board_id, user_id, role) VALUES
 (1, 1, 'owner'),
 (1, 2, 'member'),
 (1, 3, 'member');

INSERT INTO lists (board_id, title, position) VALUES
 (1, 'Backlog', 1),
 (1, 'In Progress', 2),
 (1, 'Review', 3),
 (1, 'Done', 4);

INSERT INTO cards (list_id, title, description, position, due_date) VALUES
 (1, 'Set up project repo', 'Initialize GitHub repository and basic project structure', 1, DATE_ADD(NOW(), INTERVAL 3 DAY)),
 (1, 'Design database schema', 'Design MySQL schema for boards, lists, cards, and related entities', 2, DATE_ADD(NOW(), INTERVAL 5 DAY)),
 (2, 'Implement backend APIs', 'Create Express.js REST API for Kanban operations', 1, DATE_ADD(NOW(), INTERVAL 7 DAY)),
 (2, 'Implement drag and drop UI', 'Build Trello-like drag and drop in React frontend', 2, DATE_ADD(NOW(), INTERVAL 10 DAY)),
 (3, 'Write documentation', 'Add README and deployment instructions', 1, DATE_ADD(NOW(), INTERVAL 12 DAY));

INSERT INTO labels (board_id, name, color) VALUES
 (1, 'High Priority', '#EB5A46'),
 (1, 'Medium Priority', '#FFAB4A'),
 (1, 'Low Priority', '#61BD4F'),
 (1, 'Bug', '#C377E0');

INSERT INTO card_labels (card_id, label_id) VALUES
 (1, 3),
 (2, 1),
 (3, 1),
 (4, 2),
 (4, 4);

INSERT INTO checklists (card_id, title) VALUES
 (2, 'DB Design Tasks'),
 (3, 'API Endpoints'),
 (4, 'UI Tasks');

INSERT INTO checklist_items (checklist_id, title, is_complete, position) VALUES
 (1, 'Boards & Lists tables', 1, 1),
 (1, 'Cards table', 0, 2),
 (1, 'Labels & members tables', 0, 3),
 (2, 'GET board with nested data', 1, 1),
 (2, 'POST create card', 0, 2),
 (3, 'Implement drag & drop library', 0, 1),
 (3, 'Style lists and cards', 0, 2);

INSERT INTO card_members (card_id, user_id) VALUES
 (1, 1),
 (2, 1),
 (2, 2),
 (3, 2),
 (4, 3);

INSERT INTO comments (card_id, user_id, content) VALUES
 (1, 1, 'Let''s use a clean monorepo structure.'),
 (2, 2, 'We should support labels, members, and checklists.'),
 (3, 3, 'Remember to keep endpoints RESTful.'),
 (4, 1, 'Aim for Trello-like drag and drop behavior.');
