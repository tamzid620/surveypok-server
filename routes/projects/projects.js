// projects.js

const express = require("express");
const { ObjectId } = require("mongodb");

module.exports = function projectsRoutes(projectsCollection) {
  const router = express.Router();

  // =========================================================
  // CREATE PROJECT
  // =========================================================

  router.post("/create-project", async (req, res) => {
    try {
      const {
        projectName,
        organization,
        date,
        duration,
        totalAmount,
      } = req.body;

      // Basic validation
      if (
        !projectName ||
        !organization ||
        !date ||
        !duration ||
        totalAmount === undefined ||
        totalAmount === null
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Project name, organization, date, duration and total amount are required",
        });
      }

      // Create new project
      const newProject = {
        projectName,
        organization,
        date,
        duration,
        totalAmount: Number(totalAmount),
        // Timestamps
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Insert into MongoDB
      const result = await projectsCollection.insertOne(newProject);

      res.status(201).json({
        success: true,
        message: "Project created successfully",
        data: {
          id: result.insertedId,
          ...newProject,
        },
      });
    } catch (error) {
      console.error("Error creating project:", error);

      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  });


  // =========================================================
  // GET ALL PROJECTS
  // =========================================================

  router.get("/all-projects", async (req, res) => {
    try {
    

      res.status(200).json({
        success: true,
    
      });
    } catch (error) {
      console.error("Error fetching all projects:", error);

      res.status(500).json({
        success: false,
        message: "Error fetching all projects",
      });
    }
  });

  // =========================================================
  // UPDATE / EDIT PROJECT
  // =========================================================

  router.patch("/update-project/:id", async (req, res) => {
    try {
      const { id } = req.params;

      // Request body
      const {
        projectName,
        organization,
        date,
        duration,
        totalAmount,
      } = req.body;

      // Validate ObjectId
      if (!ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid project ID",
        });
      }

      // Fields to update
      const updateFields = {};

      if (projectName !== undefined) {
        updateFields.projectName = projectName;
      }

      if (organization !== undefined) {
        updateFields.organization = organization;
      }

      if (date !== undefined) {
        updateFields.date = date;
      }

      if (duration !== undefined) {
        updateFields.duration = duration;
      }

      if (totalAmount !== undefined) {
        updateFields.totalAmount = Number(totalAmount);
      }

      if (
        status !== undefined &&
        ["Pending", "Accepted", "Rejected"].includes(status)
      ) {
        updateFields.status = status;
      }

      // Check if anything was provided
      if (Object.keys(updateFields).length === 0) {
        return res.status(400).json({
          success: false,
          message: "No valid fields provided to update",
        });
      }

      // Update timestamp
      updateFields.updatedAt = new Date();

      // Update MongoDB
      const result = await projectsCollection.updateOne(
        { _id: new ObjectId(id) },
        {
          $set: updateFields,
        }
      );

      if (result.matchedCount === 0) {
        return res.status(404).json({
          success: false,
          message: "Project not found",
        });
      }

      res.status(200).json({
        success: true,
        message: "Project updated successfully",
      });
    } catch (error) {
      console.error("Error updating project:", error);

      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  });

  // =========================================================
  // DELETE PROJECT
  // =========================================================

  router.delete("/delete-project/:id", async (req, res) => {
    try {
      const { id } = req.params;

      // Validate ObjectId
      if (!ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid project ID",
        });
      }

      const result = await projectsCollection.deleteOne({
        _id: new ObjectId(id),
      });

      if (result.deletedCount === 0) {
        return res.status(404).json({
          success: false,
          message: "Project not found",
        });
      }

      res.status(200).json({
        success: true,
        message: "Project deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting project:", error);

      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  });

  return router;
};