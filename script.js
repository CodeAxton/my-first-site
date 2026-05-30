const DB_NAME = "axton-portfolio";
const DB_VERSION = 1;
const STORE = "projects";

const sampleProjects = [
  {
    id: "sample-portfolio-start",
    name: "Portfolio starter",
    focus: "HTML, CSS, JavaScript",
    description: "A clean place to save projects, screenshots, and notes while learning to code.",
    status: "In progress",
    link: "",
    fileName: "",
    fileType: "",
    fileData: "",
    createdAt: new Date().toISOString(),
    sample: true
  }
];

const form = document.querySelector("#projectForm");
const grid = document.querySelector("#projectGrid");
const emptyState = document.querySelector("#emptyState");
const fileInput = document.querySelector("#projectFile");
const fileName = document.querySelector("#fileName");
const formNote = document.querySelector("#formNote");
const exportButton = document.querySelector("#exportData");
const importInput = document.querySelector("#importData");
const clearButton = document.querySelector("#clearProjects");
const template = document.querySelector("#projectTemplate");

let db;

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE)) {
        database.createObjectStore(STORE, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function txStore(mode = "readonly") {
  return db.transaction(STORE, mode).objectStore(STORE);
}

function getAllProjects() {
  return new Promise((resolve, reject) => {
    const request = txStore().getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function saveProject(project) {
  return new Promise((resolve, reject) => {
    const request = txStore("readwrite").put(project);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function deleteProject(id) {
  return new Promise((resolve, reject) => {
    const request = txStore("readwrite").delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function clearProjectStore() {
  return new Promise((resolve, reject) => {
    const request = txStore("readwrite").clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function readFile(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve({ fileName: "", fileType: "", fileData: "" });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      resolve({
        fileName: file.name,
        fileType: file.type || "application/octet-stream",
        fileData: reader.result
      });
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function formatDate(value) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(value));
}

function fileExtension(name = "") {
  const extension = name.split(".").pop();
  return extension && extension !== name ? extension.slice(0, 5) : "file";
}

function createDownloadLink(project) {
  if (!project.fileData) return null;

  const link = document.createElement("a");
  link.href = project.fileData;
  link.download = project.fileName || `${project.name}-upload`;
  link.textContent = "Download file";
  return link;
}

function renderMedia(project, media) {
  media.textContent = "";

  if (project.fileData && project.fileType.startsWith("image/")) {
    const image = document.createElement("img");
    image.src = project.fileData;
    image.alt = `${project.name} upload preview`;
    media.append(image);
    return;
  }

  const tile = document.createElement("span");
  tile.className = "file-tile";
  tile.textContent = project.fileName ? fileExtension(project.fileName) : "code";
  media.append(tile);
}

function renderProjects(projects) {
  const ordered = [...projects].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  grid.textContent = "";
  emptyState.hidden = ordered.length > 0;

  ordered.forEach((project) => {
    const card = template.content.firstElementChild.cloneNode(true);
    const media = card.querySelector(".project-media");
    const status = card.querySelector(".status-pill");
    const date = card.querySelector("time");
    const title = card.querySelector("h3");
    const focus = card.querySelector(".project-focus");
    const description = card.querySelector(".project-description");
    const links = card.querySelector(".project-links");
    const remove = card.querySelector(".delete-button");

    renderMedia(project, media);
    status.textContent = project.status || "Learning";
    date.dateTime = project.createdAt;
    date.textContent = formatDate(project.createdAt);
    title.textContent = project.name;
    focus.textContent = project.focus || "Learning project";
    description.textContent = project.description || "No description yet.";

    if (project.link) {
      const link = document.createElement("a");
      link.href = project.link;
      link.target = "_blank";
      link.rel = "noreferrer";
      link.textContent = "Open project";
      links.append(link);
    }

    const download = createDownloadLink(project);
    if (download) links.append(download);

    if (project.sample) {
      remove.hidden = true;
    } else {
      remove.addEventListener("click", async () => {
        await deleteProject(project.id);
        formNote.textContent = `"${project.name}" was removed.`;
        await refresh();
      });
    }

    grid.append(card);
  });
}

async function refresh() {
  const projects = await getAllProjects();
  const savedProjects = projects.filter((project) => !project.sample);
  const staleSamples = projects.filter((project) => project.sample);
  await Promise.all(staleSamples.map((project) => deleteProject(project.id)));
  renderProjects(savedProjects.length > 0 ? savedProjects : sampleProjects);
  emptyState.hidden = savedProjects.length > 0;
}

function projectFromForm(filePayload) {
  return {
    id: crypto.randomUUID(),
    name: form.projectName.value.trim(),
    focus: form.projectFocus.value.trim(),
    description: form.projectDescription.value.trim(),
    link: form.projectLink.value.trim(),
    status: form.projectStatus.value,
    createdAt: new Date().toISOString(),
    ...filePayload
  };
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  formNote.textContent = "Saving...";

  try {
    const filePayload = await readFile(fileInput.files[0]);
    const project = projectFromForm(filePayload);
    await saveProject(project);
    form.reset();
    fileName.textContent = "Screenshot, code file, PDF, or zip";
    formNote.textContent = `"${project.name}" was saved.`;
    await refresh();
    document.querySelector("#projects").scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    formNote.textContent = "That project could not be saved. Try a smaller file.";
    console.error(error);
  }
});

fileInput.addEventListener("change", () => {
  fileName.textContent = fileInput.files[0]?.name || "Screenshot, code file, PDF, or zip";
});

exportButton.addEventListener("click", async () => {
  const projects = (await getAllProjects()).filter((project) => !project.sample);
  const payload = JSON.stringify({ exportedAt: new Date().toISOString(), projects }, null, 2);
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "axton-portfolio-projects.json";
  link.click();
  URL.revokeObjectURL(url);
  formNote.textContent = "Portfolio data exported.";
});

importInput.addEventListener("change", async () => {
  const file = importInput.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const data = JSON.parse(text);
    const projects = Array.isArray(data.projects) ? data.projects : [];
    await Promise.all(projects.map((project) => saveProject({ ...project, id: project.id || crypto.randomUUID() })));
    formNote.textContent = `${projects.length} projects imported.`;
    await refresh();
  } catch (error) {
    formNote.textContent = "Import failed. Choose a portfolio JSON export.";
    console.error(error);
  } finally {
    importInput.value = "";
  }
});

clearButton.addEventListener("click", async () => {
  const confirmed = window.confirm("Clear saved projects from this browser?");
  if (!confirmed) return;

  await clearProjectStore();
  formNote.textContent = "Saved projects cleared.";
  await refresh();
});

openDb()
  .then((database) => {
    db = database;
    return refresh();
  })
  .catch((error) => {
    formNote.textContent = "Browser storage is unavailable. Try opening the site in a modern browser.";
    console.error(error);
  });
