var indexed = {};
var request = { name: "<name>", categories: [] };
const bturl = "https://bedrocktweaks.net/api/resource-packs";
const zipInput = document.getElementById("zipFileInput");
var flattened;

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
        indexed[category.name] = category.id;
        category.packs.forEach((pack) => {
          indexed[pack.name] = pack.id;
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

Promise.all([fetchAndIndex(), fetchFlatten()]);

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
                          }
                        } else {
                          currentCategory.packs.push(indexed[e]);
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

var processbutton = document.getElementById("processButton");
function upload() {
  /* I fucking hate mobile */
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
                    downloadLink.download = `${request.name}.mcpack`;
                    document.body.appendChild(downloadLink);
                    downloadLink.click();
                    document.body.removeChild(downloadLink);
                    logger("Download pack!");
                    processbutton.disabled = false;
                  });
              });
            }
          });
        });
      };
      reader.readAsArrayBuffer(blob);
    })
    .catch((error) => {
      logger("Error:", response.status);
      processbutton.disabled = false;
    });
}
