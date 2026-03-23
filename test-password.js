const bcrypt = require('bcryptjs');

const storedHash = "$2a$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW";
const password = 'password123';

bcrypt.compare(password, storedHash, (err, result) => {
  if (err) console.error('Error:', err);
  else console.log('Password match:', result);
});