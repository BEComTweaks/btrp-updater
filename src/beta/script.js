var indexed = {};
var request = { name: "<name>", categories: [] };
const bturl = "https://dev.bedrocktweaks.net/api/resource-packs";
const zipInput = document.getElementById("zipFileInput");
var flattened;

const catHTML = "<summary><!--category--></summary><!--packs-->";
const packHTML =
  '<div><input type="checkbox" data-category="<!--category-->" id="<!--id-->"><label for="<!--id-->"><!--pack--></label></div>';
const listPacks = document.querySelector(".listPacks");

function logger(msg) {
  console.log(msg);
  const log = document.querySelector("pre.log");
  var label = document.createElement("div");
  label.textContent = msg;
  log.appendChild(label);
}
logger("Sent GET request");
function fetchAndIndex() {
  return fetch(bturl, {
    method: "GET",
  })
    .then((response) => {
      if (!response.ok) {
        alert(`Something went wrong. ${response.status}`);
        throw new Error(`Status: ${response.status}`);
      }
      return response.json();
    })
    .then((data) => {
      logger("Received JSON");
      logger("Indexing...");
      delete data.combinations;
      delete data.deepMergeFiles;
      data.categories.forEach((category) => {
        var categoryHTML = document.createElement("details");
        var categoryListed = catHTML
          .replace("<!--category-->", category.name)
          .split("<!--packs-->");
        indexed[category.name] = category.id;
        category.packs.forEach((pack) => {
          const packText = packHTML
            .replace("<!--category-->", category.name)
            .replace(/<!--id-->/g, pack.id)
            .replace("<!--pack-->", pack.name);
          categoryListed[categoryListed.length - 2] += packText;
          indexed[pack.name] = pack.id;
        });
        categoryHTML.innerHTML = categoryListed.join("");
        listPacks.appendChild(categoryHTML);
        categoryHTML.querySelectorAll("input").forEach((element) => {
          element.addEventListener("change", function (event) {
            const category = event.target.dataset.category;
            const pack = event.target.id;
            let exists = false;
            try {
              request.categories.forEach((e) => {
                if (e.id === indexed[category]) {
                  exists = true;
                  if (event.target.checked) {
                    e.packs.push(pack);
                  } else {
                    e.packs.pop(e.packs.indexOf(pack));
                    if (e.packs.length === 0) {
                      request.categories.pop(request.categories.indexOf(e));
                    }
                  }
                }
              });
              if (!exists) {
                request.categories.push({
                  id: indexed[category],
                  packs: [pack],
                });
              }
            } catch (e) {
              request.categories = {
                id: indexed[category],
                packs: [pack],
              };
              OreUI.becomeEnabled(document.querySelector(".version"));
              OreUI.becomeEnabled(document.getElementById("processButton"));
              OreUI.becomeEnabled(document.querySelector(".packName"));
            }
            const params = new URLSearchParams(window.location.search);
            if (request.categories.length === 0) {
              params.delete("lz_data");
            } else {
              params.set(
                "lz_data",
                LZString.compressToEncodedURIComponent(JSON.stringify(request)),
              );
            }
            const newUrl = `${window.location.pathname}?${params.toString()}`;
            window.history.replaceState({}, "", newUrl);
          });
        });
      });
      logger("Indexing complete!");
      OreUI.becomeEnabled(document.querySelector(".fileInput"));
      OreUI.becomeEnabled(zipInput);
    })
    .catch((error) => {
      logger("Error fetching the JSON:", error);
    });
}

function fetchFlatten() {
  return fetch("flattened.json")
    .then((response) => {
      if (!response.ok) {
        //how.
        throw new Error("What have you done");
      }
      return response.json();
    })
    .then((data) => {
      flattened = data;
      logger("Received flattened JSON");
    });
}

Promise.all([fetchAndIndex(), fetchFlatten()]).then(() => {
  const loadedparams = new URLSearchParams(window.location.search);
  if (loadedparams.has("name")) {
    document.querySelector(".packName").value = loadedparams.get("name");
  }
  if (loadedparams.has("lz_data")) {
    logger("Using Query Parameters");
    request = JSON.parse(
      LZString.decompressFromEncodedURIComponent(loadedparams.get("lz_data")),
    );
    request.categories.forEach((category) => {
      category.packs.forEach((pack) => {
        // hope
        document.querySelector(`input[id="${pack}"]`).checked = true;
      });
    });
    document.querySelector(".fileInput div").innerText = "Using Query Parameters";
    OreUI.becomeEnabled(document.querySelector(".version"));
    OreUI.becomeEnabled(document.getElementById("processButton"));
    OreUI.becomeEnabled(document.querySelector(".packName"));
  }
});

document.querySelector(".fileInput").addEventListener("click", function () {
  zipInput.click();
});

zipInput.addEventListener("change", function (event) {
  request = { name: "<name>", categories: [] };
  const file = event.target.files[0];
  if (file) {
    logger("File selected");
    logger("Processing file...");
    const reader = new FileReader();
    reader.onload = function (e) {
      JSZip.loadAsync(e.target.result).then(function (zip) {
        let noissue = true;
        let filesFound = [false, false]; // [packs.info, manifest.json]

        const processPacksInfo = new Promise((resolve, reject) => {
          try {
            zip.forEach(function (relativePath, zipEntry) {
              if (relativePath.endsWith("packs.info")) {
                filesFound[0] = true;
                zipEntry.async("string").then(function (content) {
                  const read = content
                    .replace("Selected Packs:\n", "")
                    .replace(/- /g, "")
                    .replace(/:/g, "")
                    .trim();
                  const packjson = read.split("\n");
                  let currentCategory = null;
                  let invalid = false;
                  let fuckedUpCombinations = false;
                  packjson.forEach((e) => {
                    if (!fuckedUpCombinations) {
                      if (e.startsWith(" ")) {
                        // pack
                        e = e.trim();
                        if (indexed[e] === undefined) {
                          if (
                            flattened["categories"][currentCategory.id][e] ===
                            undefined
                          ) {
                            logger(`${e} isn't a valid pack`);
                            invalid = true;
                          } else {
                            currentCategory.packs.push(
                              flattened["categories"][currentCategory.id][e],
                            );
                            document.querySelector(
                              `input#${flattened["categories"][currentCategory.id][e]}`,
                            ).checked = true;
                          }
                        } else {
                          currentCategory.packs.push(indexed[e]);
                          document.querySelector(
                            `input[id="${indexed[e]}"]`,
                          ).checked = true;
                        }
                      } else {
                        // category
                        if (currentCategory !== null) {
                          if (indexed[e] === undefined) {
                            if (flattened["category"][e] === undefined) {
                              fuckedUpCombinations = true;
                            } else {
                              request.categories.push(currentCategory);
                              currentCategory = {
                                id: flattened["category"][e],
                                packs: [],
                              };
                            }
                          }
                          if (currentCategory.packs.length > 0) {
                            request.categories.push(currentCategory);
                          }
                        }
                        currentCategory = {
                          id: indexed[e],
                          packs: [],
                        };
                      }
                    }
                  });
                  if (invalid) {
                    logger("Some packs have been removed because");
                    logger("DrAV doesnt want deprecated features");
                  }
                  resolve();
                });
              }
            });
          } catch (e) {
            logger("Error processing file", e);
            noissue = false;
            reject(e);
          }
        });

        const processManifestJson = new Promise((resolve, reject) => {
          try {
            zip.forEach(function (relativePath, zipEntry) {
              if (relativePath.endsWith("manifest.json")) {
                filesFound[1] = true;
                zipEntry.async("string").then(function (content) {
                  try {
                    const mf = JSON.parse(content);
                    document.querySelector(".packName").value = mf.header.name;
                    resolve();
                  } catch (e) {
                    logger("Error parsing manifest.json", e);
                    reject(e);
                  }
                });
              }
            });
          } catch (e) {
            logger("Error processing file", e);
            noissue = false;
            reject(e);
          }
        });

        Promise.all([processPacksInfo, processManifestJson])
          .then(() => {
            if (filesFound[0] && filesFound[1] && noissue) {
              logger("Processed file");
              document.querySelector(".fileInput div").innerText = file.name;
              OreUI.becomeEnabled(document.querySelector(".version"));
              OreUI.becomeEnabled(document.getElementById("processButton"));
              OreUI.becomeEnabled(document.querySelector(".packName"));
              const params = new URLSearchParams(window.location.search);
              params.set("name", document.querySelector(".packName").value);
              params.set(
                "lz_data",
                LZString.compressToEncodedURIComponent(JSON.stringify(request)),
              );
              const newUrl = `${window.location.pathname}?${params.toString()}`;
              window.history.replaceState({}, "", newUrl);
            } else {
              logger("Upload a proper pack.");
            }
          })
          .catch((e) => {
            logger("Error processing file", e);
          });
      });
    };
    reader.readAsArrayBuffer(file);
  }
});

document.querySelectorAll("input[type=checkbox]").forEach((element) => {
  element.addEventListener("change", function (event) {
    console.log("Changed");
  });
});

var processbutton = document.getElementById("processButton");
function upload() {
  /* I fucking hate mobile */
  var request = { name: document.querySelector(".packName").value, categories: [] };
  document.querySelectorAll(".listPacks input[type='checkbox']:checked").forEach((checkbox) => {
    const category = indexed[checkbox.dataset.category];
    const pack = checkbox.id;
    let exists = false;
    try {
      request.categories.forEach((e) => {
        if (e.id === category) {
          exists = true;
          e.packs.push(pack);
        }
      });
      if (!exists) {
        request.categories.push({
          id: category,
          packs: [pack],
        });
      }
    } catch (e) {
      request.categories = {
        id: category,
        packs: [pack],
      };
    }
  });
  console.log(request);
  processbutton.disabled = true;
  logger("Sent POST request");
  fetch(bturl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  })
    .then((response) => {
      if (!response.ok) {
        alert(`Something went wrong. ${response.status}`);
        processbutton.disabled = false;
        throw new Error(`Status: ${response.status}`);
      }
      return response.blob();
    })
    .then(async (blob) => {
      logger("Received pack");
      const reader = new FileReader();
      reader.onload = function (e) {
        JSZip.loadAsync(e.target.result).then(function (zip) {
          zip.forEach(function (relativePath, zipEntry) {
            if (relativePath.endsWith("manifest.json")) {
              zipEntry.async("string").then(function (content) {
                const mf = JSON.parse(content);
                const ver = document
                  .querySelector(".version")
                  .value.split(".")
                  .map((e) => parseInt(e));
                mf.header.min_engine_version = ver;
                zip.file("manifest.json", JSON.stringify(mf, null, 2));
                logger("Replaced version");
                zip
                  .generateAsync({ type: "blob" })
                  .then(function (updatedBlob) {
                    const downloadLink = document.createElement("a");
                    downloadLink.href = URL.createObjectURL(updatedBlob);
                    downloadLink.download = `${request.name}.zip`;
                    document.body.appendChild(downloadLink);
                    downloadLink.click();
                    document.body.removeChild(downloadLink);
                    logger("Download pack!");
                  });
              });
            }
          });
        });
      };
      reader.readAsArrayBuffer(blob);
      processbutton.disabled = false;
    })
    .catch((error) => {
      logger("Error:", response.status);
      processbutton.disabled = false;
    });
}
document.getElementById("resetButton").addEventListener("click", function () {
  if (request.categories.length > 0 || request.name !== "<name>") {
    request = { name: "<name>", categories: [] };
    const params = new URLSearchParams(window.location.search);
    params.delete("name");
    params.delete("lz_data");
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, "", newUrl);
    document
      .querySelectorAll(".listPacks input[type='checkbox']")
      .forEach((checkbox) => {
        checkbox.checked = false;
      });
    document.querySelector(".packName").value = "";
    OreUI.becomeDisabled(document.querySelector(".version"));
    OreUI.becomeDisabled(document.getElementById("processButton"));
    OreUI.becomeDisabled(document.querySelector(".packName"));

    logger("Reset all settings");
  } else {
    logger("Nothing to reset");
  }
});
