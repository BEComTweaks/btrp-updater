var indexed = {};
var request = { name: "<name>", categories: [] };
const bturl = "https://bedrocktweaks.net/api/resource-packs";
const zipInput = document.getElementById("zipFileInput");
var flattened;

function consoler(logMessage) {
  const err = new Error();
  const stack = err.stack.split("\n");
  let functionCall;
  if (stack[1].includes("consoler")) {
    functionCall = stack[2];
  } else {
    functionCall = stack[1];
  }
  console.log(`${functionCall}\n${logMessage}`);
  const consoleElement = document.querySelector("pre.log");
  const log = document.createElement("div");
  log.textContent = logMessage;
  consoleElement.appendChild(log);
}

consoler("Sent GET request");
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
      consoler("Received JSON");
      consoler("Indexing...");
      delete data.combinations;
      delete data.deepMergeFiles;
      data.categories.forEach((category) => {
        indexed[category.name] = category.id;
        category.packs.forEach((pack) => {
          indexed[pack.name] = pack.id;
        });
      });
      consoler("Indexing complete!");
      OreUI.becomeEnabled(document.querySelector(".fileInput"));
      OreUI.becomeEnabled(zipInput);
    })
    .catch((error) => {
      consoler("Error fetching the JSON:", error);
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
      consoler("Received flattened JSON");
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
    consoler("File selected");
    consoler("Processing file...");
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
                        if (!currentCategory) {
                          fuckedUpCombinations = true;
                          return;
                        }
                        if (indexed[e] === undefined) {
                          if (
                            !flattened["categories"][currentCategory.id] ||
                            flattened["categories"][currentCategory.id][e] ===
                              undefined
                          ) {
                            consoler(`${e} isn't a valid pack`);
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
                        if (
                          currentCategory &&
                          currentCategory.packs.length > 0
                        ) {
                          request.categories.push(currentCategory);
                        }

                        const catId =
                          indexed[e] ||
                          (flattened.category && flattened.category[e]);

                        if (catId !== undefined) {
                          currentCategory = { id: catId, packs: [] };
                        } else {
                          fuckedUpCombinations = true;
                          currentCategory = null;
                        }
                      }
                    }
                  });
                  if (currentCategory && currentCategory.packs.length > 0) {
                    request.categories.push(currentCategory);
                  }
                  if (invalid) {
                    consoler("Some packs have been removed because");
                    consoler("DrAV doesnt want deprecated features");
                  }
                  resolve();
                });
              }
            });
          } catch (e) {
            consoler("Error processing file", e);
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
                    // check for empty name because old version allowed it
                    // obviously we are susceptible to injections, but the most they are
                    // going to inject is their own browser, so im not the most concerned
                    if (mf.header.name.length === 0) {
                      // set to zip name without extension
                      consoler("No name available, using filename")
                      mf.header.name = file.name.replace(/\.[^/.]+$/, "");
                    }
                    document.querySelector(".packName").value = mf.header.name;
                    resolve();
                  } catch (e) {
                    consoler("Error parsing manifest.json", e);
                    reject(e);
                  }
                });
              }
            });
          } catch (e) {
            consoler("Error processing file", e);
            noissue = false;
            reject(e);
          }
        });

        Promise.all([processPacksInfo, processManifestJson])
          .then(() => {
            if (filesFound[0] && filesFound[1] && noissue) {
              consoler("Processed file");
              console.log(request);
              document.querySelector(".fileInput div").innerText = file.name;
              request.name = file.name;
              OreUI.becomeEnabled(document.querySelector(".version"));
              OreUI.becomeEnabled(document.getElementById("processButton"));
              OreUI.becomeEnabled(document.querySelector(".packName"));
            } else {
              consoler("Upload a proper pack.");
            }
          })
          .catch((e) => {
            consoler("Error processing file", e);
          });
      });
    };
    reader.readAsArrayBuffer(file);
  }
});

var processbutton = document.getElementById("processButton");
function upload() {
  request.name = document.querySelector(".packName").value;
  /* I fucking hate mobile */
  console.log(request);
  processbutton.disabled = true;
  consoler("Sent POST request");
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
      return response.json();
    })
    .then((data) => {
      if (!data || !data.downloadUrl) {
        throw new Error("Missing downloadUrl from API response");
      }
      return fetch(data.downloadUrl)
        .then((downloadResponse) => {
          if (!downloadResponse.ok) {
            throw new Error(`Status: ${downloadResponse.status}`);
          }
          return downloadResponse.blob();
        })
        .then((blob) => ({ blob, packName: data.packName }));
    })
    .then(({ blob, packName }) => {
      consoler("Received pack");
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
                consoler("Replaced version");
                zip
                  .generateAsync({ type: "blob" })
                  .then(function (updatedBlob) {
                    const downloadLink = document.createElement("a");
                    downloadLink.href = URL.createObjectURL(updatedBlob);
                    downloadLink.download = `${packName || request.name}.mcpack`;
                    document.body.appendChild(downloadLink);
                    downloadLink.click();
                    document.body.removeChild(downloadLink);
                    consoler("Download pack!");
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
      consoler("Error:", error);
      processbutton.disabled = false;
    });
}
