const { body } = require('express-validator');

const nameRule = body('name').trim().isLength({ min: 20, max: 60 })
  .withMessage('Name must be between 20 and 60 characters.');
const emailRule = body('email').trim().isEmail().withMessage('Enter a valid email address.');
const addressRule = body('address').trim().isLength({ max: 400 })
  .withMessage('Address must be at most 400 characters.');
const passwordRule = body('password').isLength({ min: 8, max: 16 })
  .withMessage('Password must be 8–16 characters.')
  .matches(/[A-Z]/).withMessage('Password must include an uppercase letter.')
  .matches(/[^A-Za-z0-9]/).withMessage('Password must include a special character.');

module.exports = { nameRule, emailRule, addressRule, passwordRule };
