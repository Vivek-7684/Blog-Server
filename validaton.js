const { z } = require("zod");

const loginSchema = z.object({
  email: z
    .string()
    .email("Invalid email address.Please Give a Valid Email Address"),
  password: z
    .string()
    .min(8, { message: "Password must be at least 8 characters long." }),
});

const blogSchema = z.object({
  title: z.string().max(100, "Maximum 100 Characters are allowed."),
  content: z.string().max(2000, "Maximum 2000 Characters are allowed.")
});

module.exports = { blogSchema, loginSchema };
