// tasks.js

// const express = require("express");
// const { ObjectId } = require("mongodb");

// module.exports = function tasksRoutes(tasksCollection){
//   const router = express.Router();

//   const taskFields = (body) => ({
//     date: body.date,
//     fromPlace: body.fromPlace,
//     fromTime: body.fromTime,
//     toPlace: body.toPlace,
//     toTime: body.toTime,
//     purpose: body.purpose,
//     transport: body.transport,
//     distance: Number(body.distance) || 0,
//     taka: Number(body.taka) || 0,
//   });


//   return router;
// };


const express = require("express");
const { ObjectId } = require("mongodb");
const middleware = require("../../middleware/middleware");

module.exports = function tasksRoutes(tasksCollection, projectsCollection) {
  const router = express.Router();

  router.use(middleware); // all task routes need a logged-in user

  // Build task fields from the request body
  const taskFields = (body) => ({
    date: body.date,
    fromPlace: body.fromPlace,
    fromTime: body.fromTime,
    toPlace: body.toPlace,
    toTime: body.toTime,
    purpose: body.purpose,
    transport: body.transport,
    distance: Number(body.distance) || 0,
    taka: Number(body.taka) || 0,
  });

  // Convert _id -> id for the frontend
  const toClient = ({ _id, ...rest }) => ({ id: _id.toString(), ...rest });

  // Make sure the project exists AND belongs to the logged-in user
  const getOwnedProject = (projectId, userId) =>
    projectsCollection.findOne({
      _id: new ObjectId(projectId),
      userId: new ObjectId(userId),
    });

  // CREATE TASK (inside a project) =============
  router.post("/create-task/:projectId", async (req, res) => {
    try {
      const { projectId } = req.params;

      if (!ObjectId.isValid(projectId) || !ObjectId.isValid(req.user.id)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid ID" });
      }

      const project = await getOwnedProject(projectId, req.user.id);
      if (!project) {
        return res
          .status(404)
          .json({ success: false, message: "Project not found" });
      }

      const fields = taskFields(req.body);
      if (!fields.date || !fields.fromPlace || !fields.toPlace) {
        return res.status(400).json({
          success: false,
          message: "Date, from place and to place are required",
        });
      }

      const newTask = {
        projectId: new ObjectId(projectId),
        userId: new ObjectId(req.user.id),
        ...fields,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await tasksCollection.insertOne(newTask);

      res.status(201).json({
        success: true,
        message: "Task created successfully",
        data: toClient({ _id: result.insertedId, ...newTask }),
      });
    } catch (error) {
      console.error("Error creating task:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // GET ALL TASKS OF ONE PROJECT (for the table) =============
  router.get("/project-tasks/:projectId", async (req, res) => {
    try {
      const { projectId } = req.params;

      if (!ObjectId.isValid(projectId) || !ObjectId.isValid(req.user.id)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid ID" });
      }

      const tasks = await tasksCollection
        .find({
          projectId: new ObjectId(projectId),
          userId: new ObjectId(req.user.id),
        })
        .sort({ date: 1, createdAt: 1 })
        .toArray();

      const data = tasks.map(toClient);

      // Handy totals for the table footer
      const totals = data.reduce(
        (acc, t) => {
          acc.distance += t.distance || 0;
          acc.taka += t.taka || 0;
          return acc;
        },
        { distance: 0, taka: 0 },
      );

      res.status(200).json({
        success: true,
        count: data.length,
        totals,
        data,
      });
    } catch (error) {
      console.error("Error fetching tasks:", error);
      res
        .status(500)
        .json({ success: false, message: "Error fetching tasks" });
    }
  });

  // GET SINGLE TASK =============
  router.get("/task/:id", async (req, res) => {
    try {
      const { id } = req.params;

      if (!ObjectId.isValid(id) || !ObjectId.isValid(req.user.id)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid ID" });
      }

      const task = await tasksCollection.findOne({
        _id: new ObjectId(id),
        userId: new ObjectId(req.user.id),
      });

      if (!task) {
        return res
          .status(404)
          .json({ success: false, message: "Task not found" });
      }

      res.status(200).json({ success: true, singleTask: toClient(task) });
    } catch (error) {
      console.error("Error fetching task:", error);
      res.status(500).json({ success: false, message: "Error fetching task" });
    }
  });

  // UPDATE TASK =============
  router.patch("/update-task/:id", async (req, res) => {
    try {
      const { id } = req.params;

      if (!ObjectId.isValid(id) || !ObjectId.isValid(req.user.id)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid ID" });
      }

      const updateFields = {};
      const textFields = [
        "date",
        "fromPlace",
        "fromTime",
        "toPlace",
        "toTime",
        "purpose",
        "transport",
      ];
      textFields.forEach((f) => {
        if (req.body[f] !== undefined) updateFields[f] = req.body[f];
      });
      if (req.body.distance !== undefined)
        updateFields.distance = Number(req.body.distance) || 0;
      if (req.body.taka !== undefined)
        updateFields.taka = Number(req.body.taka) || 0;

      if (Object.keys(updateFields).length === 0) {
        return res.status(400).json({
          success: false,
          message: "No valid fields provided to update",
        });
      }

      updateFields.updatedAt = new Date();

      const result = await tasksCollection.updateOne(
        { _id: new ObjectId(id), userId: new ObjectId(req.user.id) },
        { $set: updateFields },
      );

      if (result.matchedCount === 0) {
        return res
          .status(404)
          .json({ success: false, message: "Task not found" });
      }

      res
        .status(200)
        .json({ success: true, message: "Task updated successfully" });
    } catch (error) {
      console.error("Error updating task:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // DELETE TASK =============
  router.delete("/delete-task/:id", async (req, res) => {
    try {
      const { id } = req.params;

      if (!ObjectId.isValid(id) || !ObjectId.isValid(req.user.id)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid ID" });
      }

      const result = await tasksCollection.deleteOne({
        _id: new ObjectId(id),
        userId: new ObjectId(req.user.id),
      });

      if (result.deletedCount === 0) {
        return res
          .status(404)
          .json({ success: false, message: "Task not found" });
      }

      res
        .status(200)
        .json({ success: true, message: "Task deleted successfully" });
    } catch (error) {
      console.error("Error deleting task:", error);
      res.status(500).json({ success: false, message: "Error deleting task" });
    }
  });

  return router;
};



