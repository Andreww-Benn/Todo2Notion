// Import required modules for interacting with Notion and Todoist
const { Client } = require("@notionhq/client");
const { TodoistApi } = require("@doist/todoist-api-typescript");

// Define API keys and database ID as environment variables
const NOTION_KEY = process.env.NOTION_KEY;           // Notion API key
const NOTION_DATABASE_ID = process.env.NOTION_DATABASE_ID; // Notion database ID
const TODOIST_API_KEY = process.env.TODOIST_API_KEY;   // Todoist API key

// Initialize Notion and Todoist clients using the API keys
const notion = new Client({ auth: NOTION_KEY });
const doist = new TodoistApi(TODOIST_API_KEY);

// Function to fetch course data from Todoist and return it as an array of objects
async function fetchCourses() {
  try {
    const projects = await doist.getProjects(); // Fetch projects from Todoist
    // Map the projects to a simplified format
    return projects.map((course) => ({
      name: course.name,
      id: course.id,
    }));
  } catch (error) {
    console.error("Error fetching courses:", error);
    return [];
  }
}

// Function to fetch task data from Todoist and return it as an array of objects
async function fetchTasks(courseArray) {
  try {
    const tasks = await doist.getTasks(); // Fetch tasks from Todoist
    const taskArray = [];

    // Process each task and associate it with its parent course
    for (let task of tasks) {
      const parent = courseArray.find((course) => course.id === task.projectId); //finds project name for the task
      const processedDate = task.due ? task.due.date : ""; //returns the due date if there is one or a blank string if not
      const processedLabel =
        task.labels[0] === undefined ? "Misc" : task.labels[0]; //returns the tasks label if it has one or misc if not
      const taskData = {
        name: task.content,
        date: processedDate,
        label: processedLabel,
        projectID: task.projectId,
        course: parent.name,
      };

      taskArray.push(taskData); // Add processed task data to the array
    }

    return taskArray;
  } catch (error) {
    console.error("Error fetching tasks:", error);
    return [];
  }
}

// Function to create Notion pages based on the retrieved task data
async function createNotionPage() {
  try {
    const courseArray = await fetchCourses(); // Fetch and process course data
    const taskArray = await fetchTasks(courseArray); // Fetch and process task data

    // Iterate through the task data and create Notion pages for each task
    for (let task of taskArray) {
      const data = {
        parent: {
          type: "database_id",
          database_id: NOTION_DATABASE_ID,
        },
        properties: {
          Name: {
            title: [
              {
                text: {
                  content: task.name,
                },
              },
            ],
          },
          Dates: task.date 
            ? { //if there is a due date add it if not set it to undefined
                type: "date",
                date: {
                  start: task.date,
                },
              }
            : undefined,
          Type: {
            select: {
              name: task.label,
            },
          },
          Course: {
            select: {
              name: task.course,
            },
          },
        },
      };

      // Insert the task data as a new Notion page
      const response = await notion.pages.create(data);
      console.log(response);

      console.log("Operation complete.");
    }
  } catch (error) {
    console.error("Error creating Notion pages:", error);
  }
}

// Call the createNotionPage function to start the process
createNotionPage();
