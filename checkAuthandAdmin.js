const jwt = require("jsonwebtoken");

const checkAuthandAdmin = (req, res, next) => {
  try {
    const token = req?.cookies?.token;

    if (!token) {
      return res.status(401).json({ message: "Token not Found!" });
    }

    jwt.verify(token, "spiderman@123", (err, decoded) => {
      if (err) {
        res.status(401).json({ message: err.message });
      } else {
        console.log(decoded);
        next();
      }
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

module.exports = checkAuthandAdmin;
