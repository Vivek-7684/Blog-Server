require("dotenv").config();
const express = require("express");
const { loginSchema, blogSchema } = require("./validaton");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const multer = require("multer");
const cookieparser = require("cookie-parser");
const { fromZodError } = require("zod-validation-error");
const checkAuthandAdmin = require("./checkAuthandAdmin");
const path = require("path");

const app = express();
app.use(cookieparser());

app.use(express.json());

app.use(
  cors({
    origin: "http://localhost:5173",
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);

app.use("/uploads", express.static("uploads"));

let connection;

(async () => {
  connection = await require("./db");
})();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "./uploads");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const fileFilter = (req, file, cb) => {
  if (
    file.mimetype === "image/jpeg" ||
    file.mimetype === "image/png" ||
    file.mimetype === "image/webp"
  ) {
    cb(null, true);
  } else {
    cb(
      new Error(
        "Invalid File Type.Only .jpeg,.webp and .png files are Allowed."
      ),
      false
    );
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
});

app.post("/login", async (req, res) => {
  try {
    let { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ error: "Username and password are required." });
    }

    const validationResult = loginSchema.safeParse({ email, password });

    if (!validationResult.success) {
      return res
        .status(400)
        .json({ error: fromZodError(validationResult.error).message });
    }

    const result = await connection.execute(
      "SELECT PASSWORD FROM BlogUser where email = ?",
      [email]
    );

    if (result[0].length === 0) {
      return res.status(401).json({ error: "User does not exist" });
    }

    bcrypt.compare(password, result[0][0].PASSWORD, (err, isMatch) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      } else if (!isMatch) {
        return res.status(401).json({
          error:
            "Wrong Email or Password.Please Provide Valid Email and Password.",
        });
      } else {
        const token = jwt.sign({ email: email }, "spiderman@123", {
          expiresIn: "1h",
        });

        res.cookie("token", token, {
          httpOnly: true,
          secure: true,
          maxAge: 3600000,
        });

        return res.status(200).json(token);
      }
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.post(
  "/addBlog",
  checkAuthandAdmin,
  upload.single("image"),
  async (req, res) => {
    try {
      const { title, content } = req.body;

      const image = req.file;

      if (!title || !content || !image) {
        return res.status(400).json({ error: "All Fields are required." });
      }

      const result = blogSchema.safeParse({
        title: req.body.title,
        content: req.body.content,
        image: image.path,
      });

      if (!result.success) {
        return res
          .status(400)
          .json({ error: fromZodError(result.error).message });
      }

      const QueryResult = await connection.execute(
        "insert into Blog(title,content,image_url) values (?,?,?) ",
        [title, content, image.path]
      );

      return res.status(201).json({ message: "Blog Created Successfully!" });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }
);

app.get("/blog", async (req, res) => {
  const { title } = req.query;

  let params = [];
  let query = `select * from Blog WHERE 1=1`;

  if (title) {
    query += ` AND title = ?`;
    params.push(title);
  }

  const [rows] = await connection.execute(query,params);

  if (rows.length === 0) {
    return res
      .status(404)
      .json({ message: "No Blog is available to show.Please Add Your Blog." });
  }
  res.status(200).send(result);
});

app.listen(process.env.PORT, () => {
  console.log("Server is running on port 3000");
});
