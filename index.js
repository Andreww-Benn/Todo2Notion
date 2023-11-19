// Import required modules for interacting with Notion and Todoist
const { Client } = require("@notionhq/client");
const Todoist = require('todoist').v9

// Define API keys and database ID as environment variables
const NOTION_KEY = process.env.NOTION_KEY; // Notion API key
const NOTION_DATABASE_ID = process.env.NOTION_DATABASE_ID; // Notion database ID
const TODOIST_API_KEY = process.env.TODOIST_API_KEY; // Todoist API token

const fs = require('fs');
const configFilePath = 'config.json';
const fetch = require("node-fetch");

// Initialize Notion and Todoist clients using the API keys
const notion = new Client({ auth: NOTION_KEY });
const todoist = Todoist(TODOIST_API_KEY)

function readConfig() {
  try {
    const configData = fs.readFileSync(configFilePath, 'utf8');
    return configData ? JSON.parse(configData) : {};
  } catch (error) {
    console.error('Error reading configuration:', error);
    return {};
  }
}

// Function to write the configuration to the file
function writeConfig(config) {
  try {
    const token = {
      token: config,
    };
    fs.writeFileSync(configFilePath, JSON.stringify(token));
    console.log('Configuration file updated successfully.');
  } catch (error) {
    console.error('Error writing configuration:', error);
  }
}

async function fetchProjects() {
  try {
    await todoist.sync()
    const projects = todoist.projects.get(); // Fetch projects from Todoist
    // Map the projects to a simplified format
    return projects.map((project) => ({
      name: project.name,
      id: project.id
    }));
  } catch (error) {
    console.error("Error fetching projects:", error);
    return [];
  }
}

async function fetchTasks(projectArray) {
  try {
    const config = readConfig();
    const syncToken = config.token || '*';
    console.log(syncToken)
    const url = 'https://api.todoist.com/sync/v9/sync';
    const data = `sync_token=${syncToken}&resource_types=["items"]`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TODOIST_API_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: data,
    });

    const result = await response.json();

    if (!result || !result.items || !result.sync_token) {
      console.error('Error fetching tasks from Todoist:', result);
      return { tasks: [], syncToken: null };
    }

    const tasks = result.items;
    const taskArray = [];

    for (let task of tasks) {
      const parent = projectArray.find((course) => course.id === task.project_id);
      const processedDate = task.due ? task.due.date : "";
      const processedLabel = task.labels[0] === undefined ? "Misc" : task.labels[0];

      const taskData = {
        name: task.content,
        date: processedDate,
        label: processedLabel,
        course: parent ? parent.name : 'Unknown', // Handle case where parent is not found
      };

      taskArray.push(taskData);
    }
    writeConfig(result.sync_token);
    return taskArray;
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return [];
  }
}


async function createNotionPage() {
  try {
    const projectArray = await fetchProjects(); // Fetch and process course data
    const taskArray = await fetchTasks(projectArray); // Fetch and process task data
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
            ? {
                //if there is a due date add it if not set it to undefined
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
