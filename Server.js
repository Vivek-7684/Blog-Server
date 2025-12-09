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
const { v4 } = require('uuid');

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
  upload.fields([
    {
      name: 'sectionImages',
      maxCount: 20
    },
    {
      name: 'image',
      maxCount: 1
    }
  ]),
  async (req, res) => {
    try {
      const { title, content, tags, summary, quote, author, occupation, sections } = req.body;

      const image = req.files['image'][0];

      if (!title || !content || !image) {
        return res.status(400).json({ error: "Title, Content and Images  are required." });
      }

      const result = blogSchema.safeParse({
        title: req.body.title,
        content: req.body.content,
      });

      if (!result.success) {
        return res
          .status(400)
          .json({ error: fromZodError(result.error).message });
      }

      const rowUUID = v4();

      [QueryResult] = await connection.execute(
        "insert into Blog (id,title, content, image_url, tags, summary, quote, author, occupation) values (?,?,?,?,?,?,?,?,?) ",
        [rowUUID, title, content, image.path, tags, summary, quote, author, occupation]
      );

      const blogId = rowUUID;

      if (sections) {
        const parsedSections = JSON.parse(sections);

        const sectionImages = req.files['sectionImages'] || [];

        for (let i = 0; i < parsedSections.length; i++) {
          const sec = parsedSections[i];

          const secImage = sectionImages[i] ? sectionImages[i].path : null;

          await connection.execute(
            `INSERT INTO BlogSection (blog_id, sub_title, content, image_url)
             VALUES (?, ?, ?, ?)`,
            [blogId, sec.subTitle, sec.content, secImage]
          );
        }
      }

      return res.status(201).json({ message: "Blog Created Successfully!" });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

app.get("/blog", async (req, res) => {
  const { title } = req.query;

  let sql = `
    SELECT 
      b.id AS blog_id, 
      b.title,
      b.content AS blog_content,
      b.image_url AS blog_image,
      b.created_at,
      bs.id AS section_id,
      bs.sub_title,
      bs.content AS section_content,
      bs.image_url AS section_image
    FROM Blog b
    LEFT JOIN BlogSection bs ON b.id = bs.blog_id
    WHERE 1=1
  `;

  const params = [];

  if (title) {
    sql += " AND b.title = ?";
    params.push(title);
  }

  const [rows] = await connection.execute(sql, params);

  if (rows.length === 0) {
    return res.status(404).json({
      message: "No Blog is available to show. Please Add Your Blog."
    });
  }

  // grouping
  const blogsMap = {};

  rows.forEach(row => {
    if (!blogsMap[row.blog_id]) {
      blogsMap[row.blog_id] = {
        blog_id: row.blog_id,
        title: row.title,
        content: row.blog_content,
        image_url: row.blog_image,
        created_at: row.created_at,
        sections: []
      };
    }
    if (row.section_id) {
      blogsMap[row.blog_id].sections.push({
        section_id: row.section_id,
        sub_title: row.sub_title,
        content: row.section_content,
        image_url: row.section_image
      });
    }
  });

  const response = Object.values(blogsMap);

  res.status(200).json(response);
});


app.listen(process.env.PORT, () => {
  console.log("Server is running on port 3000");
});
