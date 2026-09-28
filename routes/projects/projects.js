// projects.js

const express = require("express");
const { ObjectId } = require("mongodb");
const auth = require("../../auth/auth");

module.exports = function projectsRoutes(projectsCollection) {
  const router = express.Router();
  
  router.use(auth); // every route below now requires a logged-in user
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

      // Check authentication
      if (!req.user || !req.user.id) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized. User not found.",
        });
      }

      // Validate project data
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

      // Validate MongoDB user ID
      if (!ObjectId.isValid(req.user.id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid user ID",
        });
      }

      // Create project
      const newProject = {
        userId: new ObjectId(req.user.id),
        projectName,
        organization,
        date,
        duration,
        totalAmount: Number(totalAmount),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Insert into MongoDB
      const result = await projectsCollection.insertOne(newProject);

      res.status(201).json({
        success: true,
        message: "Project created successfully",
        data: {
          id: result.insertedId.toString(),
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
    // Newest first (same order the frontend showed with localStorage)
    const projects = await projectsCollection
      .find({ userId: new ObjectId(req.user.id)})
      .sort({ createdAt: -1 })
      .toArray();

    // Frontend uses `p.id`, but MongoDB stores `_id`, so rename it to `id`
    const data = projects.map(({ _id, ...rest }) => ({
      id: _id.toString(),
      ...rest,
    }));

    res.status(200).json({
      success: true,
      count: data.length,
      data,
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

  // router.patch("/update-project/:id", async (req, res) => {
  //   try {
  //     const { id } = req.params;

  //     // Request body
  //     const {
  //       projectName,
  //       organization,
  //       date,
  //       duration,
  //       totalAmount,
  //     } = req.body;

  //     // Validate ObjectId
  //     if (!ObjectId.isValid(id)) {
  //       return res.status(400).json({
  //         success: false,
  //         message: "Invalid project ID",
  //       });
  //     }

  //     // Fields to update
  //     const updateFields = {};

  //     if (projectName !== undefined) {
  //       updateFields.projectName = projectName;
  //     }

  //     if (organization !== undefined) {
  //       updateFields.organization = organization;
  //     }

  //     if (date !== undefined) {
  //       updateFields.date = date;
  //     }

  //     if (duration !== undefined) {
  //       updateFields.duration = duration;
  //     }

  //     if (totalAmount !== undefined) {
  //       updateFields.totalAmount = Number(totalAmount);
  //     }

  //     if (
  //       status !== undefined &&
  //       ["Pending", "Accepted", "Rejected"].includes(status)
  //     ) {
  //       updateFields.status = status;
  //     }

  //     // Check if anything was provided
  //     if (Object.keys(updateFields).length === 0) {
  //       return res.status(400).json({
  //         success: false,
  //         message: "No valid fields provided to update",
  //       });
  //     }

  //     // Update timestamp
  //     updateFields.updatedAt = new Date();

  //     // Update MongoDB
  //     const result = await projectsCollection.updateOne(
  //       { _id: new ObjectId(id) },
  //       {
  //         $set: updateFields,
  //       }
  //     );

  //     if (result.matchedCount === 0) {
  //       return res.status(404).json({
  //         success: false,
  //         message: "Project not found",
  //       });
  //     }

  //     res.status(200).json({
  //       success: true,
  //       message: "Project updated successfully",
  //     });
  //   } catch (error) {
  //     console.error("Error updating project:", error);

  //     res.status(500).json({
  //       success: false,
  //       message: error.message,
  //     });
  //   }
  // });

  // =========================================================
  // DELETE PROJECT
  // =========================================================

  // router.delete("/delete-project/:id", async (req, res) => {
  //   try {
  //     const { id } = req.params;

  //     // Validate ObjectId
  //     if (!ObjectId.isValid(id)) {
  //       return res.status(400).json({
  //         success: false,
  //         message: "Invalid project ID",
  //       });
  //     }

  //     const result = await projectsCollection.deleteOne({
  //       _id: new ObjectId(id),
  //     });

  //     if (result.deletedCount === 0) {
  //       return res.status(404).json({
  //         success: false,
  //         message: "Project not found",
  //       });
  //     }

  //     res.status(200).json({
  //       success: true,
  //       message: "Project deleted successfully",
  //     });
  //   } catch (error) {
  //     console.error("Error deleting project:", error);

  //     res.status(500).json({
  //       success: false,
  //       message: error.message,
  //     });
  //   }
  // });

  return router;
};