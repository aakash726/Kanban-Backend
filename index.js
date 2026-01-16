const app = require('./src/app');
const cors = require('cors');

const PORT = process.env.PORT || 4000;

app.use(cors());

app.listen(PORT, () => {
  console.log(`Backend API server running on port ${PORT}`);
});
