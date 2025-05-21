import express from "express";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
const app = express();
const PORT = process.env.PORT || 3000;
import Employee from "./models/Employee.js";
import AttendanceRecord from "./models/AttendanceRecord.js";
import dotenv from 'dotenv';
import fs from 'fs';
import multer from 'multer';
import axios from "axios";
dotenv.config();


// Secret key for JWT signing (use environment variable in production)
const JWT_SECRET = "Yash@FaceAttendance";

// Middleware
app.use(express.json());


// Middleware to verify JWT
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Unauthorized: No token provided" });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: "Forbidden: Invalid token" });
    }

    req.user = decoded;
    next();
  });
};

app.get("/", (req,res) => {
    res.send("api is running!!");
})

// Endpoint to get all employees with face embeddings
app.get("/api/employees", async (req, res) => {
  try {
    console.log("employees api called");
    const employees = await Employee.find({ faceImg: { $exists: true } });
    const formatted = employees.map(emp => ({
      name: emp.name,
      email: emp.email,
      employeeId: emp.employeeId,
      faceImg: emp.faceImg
    }));
    res.json(formatted);
  } catch (err) {
    console.error("Error fetching employees:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post('/store-embedding', async (req, res) => {
  const { employeeId, faceEmbedding } = req.body;

  try {
    console.log("store embedding called!!");
    // Check if the employee already has a face embedding stored
    let employee = await Employee.findOne({ employeeId });

    // If the employee doesn't exist or doesn't have a face embedding
    if (!employee || !employee.faceImg) {
      // If no embedding, save the new embedding
      if (!employee) {
        // If the employee doesn't exist in the database, create a new one
        employee = new Employee({
          employeeId,
          name: req.body.name,  // Assuming name is also provided
          email: req.body.email, // Assuming email is also provided
          faceImg: Object.values(faceEmbedding), // Store the embedding
        });
      } else {
        // If employee exists but has no embedding, update with the new embedding
        employee.faceImg = Object.values(faceEmbedding);
      }

      // Save the employee with the embedding
      await employee.save();

      res.status(200).json({
        success: true,
        message: 'Embedding stored successfully',
      });
    } else {
      // If employee already has a face embedding
      res.status(400).json({
        success: false,
        message: 'Employee already has a face embedding',
      });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server Error',
    });
  }
});

// Login route
app.post("/api/auth/login", async (req, res) => {
  const { employeeId, password } = req.body;


  // Find employee by email
  const employee = await Employee.findOne({ employeeId, password });

  if (!employee || employee.password !== password) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  // Create token
  const token = jwt.sign(
    { id: employee.id, email: employee.email },
    JWT_SECRET,
    { expiresIn: "1d" }
  );

  // Return token and user (without password)
//   const { password: _, ...userWithoutPassword } = employee;
  res.json({ token: token, user: employee });
});

// Employee registration route
app.post("/api/auth/signup", async (req, res) => {
  const { name, email, password } = req.body;
  const userexists = await Employee.findOne({ email });
  if (userexists) {
    return res.status(400).send("User already exists");
  }

  await Employee.create(req.body)
    .then((user) => res.status(201).json(user))
    .catch((error) => res.status(400).send("Error registering user: " + error));

  // Return created employee (without password)
  //   const { password: _, ...employeeWithoutPassword } = newEmployee;
  //   res.status(201).json(employeeWithoutPassword);
});

// Mark attendance route
// Mark attendance route
app.post("/api/attendance/mark", authenticateToken, async (req, res) => {
  const {
    employeeId,
    timestamp,
    deviceId,
    location,
    type = "check-in",
  } = req.body;

  try {
    // Check if employee exists in DB
    console.log("attendance marking!!")
    const employee = await Employee.findOne({ employeeId });
    if (!employee) {
      return res.status(404).json({ error: "Employee not found" });
    }

    // Create new attendance record
    const record = await AttendanceRecord.create({
      employeeId,
      timestamp: timestamp || new Date().toISOString(),
      type,
      location,
      deviceId,
    });

    res.status(201).json(record);
  } catch (error) {
    console.error("Error marking attendance:", error);
    res
      .status(400)
      .json({ error: "Error marking attendance: " + error.message });
  }
});

// Get attendance history
app.get("/api/attendance/history", authenticateToken, async (req, res) => {
  const { employeeId, startDate, endDate } = req.query;

  try {
    const query = {};

    if (employeeId) {
      query.employeeId = employeeId;
    }

    if (startDate && endDate) {
      query.time = {
        $gte: new Date(startDate).toISOString(),
        $lte: new Date(endDate).toISOString(),
      };
    }

    const records = await AttendanceRecord.find(query).sort({ time: -1 });

    res.json(records);
  } catch (error) {
    console.error("Error fetching attendance history:", error);
    res.status(500).json({ error: "Failed to fetch attendance history" });
  }
});

const upload = multer({ dest: "uploads/" });

// 👇 API to upload face image and save embedding for logged-in user
app.post("/upload-embedding/:employeeId", upload.single("image"), async (req, res) => {
  const { employeeId } = req.params;

  try {
    const employee = await Employee.findOne({ employeeId });
    if (!employee) return res.status(404).json({ message: "Employee not found" });

    const imageBuffer = fs.readFileSync(req.file.path);
    fs.unlinkSync(req.file.path); // After reading the buffer


    const result = await axios.post("http://localhost:5000/get-embedding", imageBuffer, {
      headers: { "Content-Type": "application/octet-stream" }
    });

    if (!result) {
      return res.status(400).json({ message: "No face detected in image" });
    }

    // Update the existing user with FaceImg
    employee.faceImg = result.data.embedding;
    await employee.save();

    res.json({ success: true, message: "Embedding saved", employeeId });
    console.log("embeddings saved");
  } catch (error) {
    console.error("Error saving embedding:", error);
    res.status(500).send("Server error");
  }
});

app.post("/compare", upload.single('image'), async (req, res) => {
  try {
    // Prepare the FormData to send to FastAPI
    console.log("/node js compare api called");
    const imageBuffer = fs.readFileSync(req.file.path);
    fs.unlinkSync(req.file.path); // After reading the buffer

    // Send the request to FastAPI
    const fastApiResponse = await axios.post('http://localhost:5000/compare-fast-api', imageBuffer, {
      headers: {
        "Content-Type": "application/octet-stream"
      },
    });

    // Forward the response from FastAPI to the client
    return res.json(fastApiResponse.data);
  } catch (err) {
    console.error('Error forwarding request to FastAPI:', err);
    return res.status(500).json({ success: false, message: 'An error occurred while processing the request' });
  }
});

// Start server
console.log(process.env.MONGO_URL);
mongoose
  .connect(process.env.MONGO_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    app.listen(PORT, () => console.log(`Server Port: ${PORT}`));
  })
  .catch((error) => console.log(`${error} did not connect`));
