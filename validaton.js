const { z } = require("zod");

const loginSchema = z.object({
    email: z.string().email("Invalid email address.Please Give a Valid Email Address" ),
    password: z.string().min(8, { message: "Password must be at least 8 characters long." })
});


exports.loginSchema = loginSchema;