var indexed = {};
var request = {"name": "<name>", "categories": []};
const bturl = "https://dev.bedrocktweaks.net/api/resource-packs";
function logger(msg) {
    console.log(msg);
    const log = document.querySelector(".log");
    var label = document.createElement("div");
    label.textContent = msg;
    log.appendChild(label);
}
logger("Sent GET request");
fetch(bturl, {
    method: "GET"
})
    .then((response) => {
        if (!response.ok) {
            alert(`Something went wrong. ${response.status}`);
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    })
    .then((data) => {
        logger("Received JSON");
        logger("Indexing...")
        delete data.combinations;
        delete data.deepMergeFiles;
        data.categories.forEach((category) => {
            indexed[category.name] = category.id;
            category.packs.forEach((pack) => {
                indexed[pack.name] = pack.id;
            })
        })
        logger("Indexing complete!")
    })
    .catch((error) => {
        logger('Error fetching the JSON:', error);
    });

const zipInput = document.getElementById("zipFileInput");
document.querySelector(".fileInput").addEventListener("click", function() {
    zipInput.click()
})
zipInput.addEventListener("change", function(event) {
    const file = event.target.files[0];
    if (file) {
        logger("File selected");
        logger("Processing file...")
        const reader = new FileReader();
        reader.onload = function(e) {
            JSZip.loadAsync(e.target.result)
                .then(function (zip) {
                    let filesFound = [false, false] // [packs.info, manifest.json]
                    zip.forEach(function (relativePath, zipEntry) {
                        if (relativePath.endsWith("packs.info")) {
                            filesFound[0] = true;
                            zipEntry.async("string").then(function (content) {
                                const read = content.replace("Selected Packs:\n", "").replace(/- /g, "").replace(/:/g,"").trim();
                                const packjson = read.split("\n");
                                let currentCategory = null;
                                let invalid = false;
                                let fuckedUpCombinations = false;
                                packjson.forEach((e) => {
                                    if (!fuckedUpCombinations) {
                                        if (e.startsWith(" ")) { // pack
                                            e = e.trim();
                                            if (indexed[e] === undefined) {
                                                logger(`${e} isn't a valid pack`)
                                                invalid = true;
                                            } else {
                                                currentCategory.packs.push(indexed[e]);
                                            }
                                        } else { // category
                                            if (currentCategory !== null) {
                                                if (indexed[e] === undefined) {
                                                    fuckedUpCombinations = true;
                                                }
                                                if (currentCategory.packs.length > 0) {
                                                    request.categories.push(currentCategory);
                                                }
                                            }
                                            currentCategory = {
                                                id: indexed[e],
                                                packs: []
                                            };
                                        }
                                    }
                                })
                                if (invalid) {
                                    logger("This is probably caused by an internal")
                                    logger("flattening, and will be ignored")
                                }
                            })
                        }
                        if (relativePath.endsWith("manifest.json")) {
                            filesFound[1] = true;
                            zipEntry.async("string").then(function (content) {
                                try {
                                    const mf = JSON.parse(content);
                                    request.name = mf.header.name;
                                } catch (e) {
                                    logger("Error parsing manifest.json", e);
                                }
                            })
                        }
                    })
                    if (filesFound[0] && filesFound[1]) {
                        logger("Processed file");
                        document.querySelector(".fileInput div").innerText = file.name;
                        document.querySelector(".version").disabled = false;
                        document.getElementById("processButton").disabled = false;
                    } else {
                        logger("Upload a proper pack.")
                    }
                }
            )
        }
        reader.readAsArrayBuffer(file);
    }
})

function upload() {
    logger("Sent POST request");
    console.log(request);
    fetch(bturl, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(request),
    })
        .then((response) => {
            if (!response.ok) {
                alert(`Something went wrong. ${response.status}`);
            }
            return response.blob();
        })
        .then(async (blob) => {
            logger("Received pack");
            const reader = new FileReader();
            reader.onload = function(e) {
                JSZip.loadAsync(e.target.result)
                .then(function (zip) {
                    zip.forEach(function (relativePath, zipEntry) {
                        if (relativePath.endsWith("manifest.json")) {
                            zipEntry.async("string").then(function (content) {
                                const mf = JSON.parse(content);
                                const ver = document.querySelector(".version").value.split(".").map((e) => parseInt(e));
                                mf.header.min_engine_version = ver;
                                zip.file("manifest.json", JSON.stringify(mf, null, 2));
                                logger("Replaced version");
                                zip.generateAsync({ type: "blob" })
                                .then(function (updatedBlob) {
                                    const downloadLink = document.createElement("a");
                                    downloadLink.href = URL.createObjectURL(updatedBlob);
                                    downloadLink.download = "updated_pack.zip";
                                    document.body.appendChild(downloadLink);
                                    downloadLink.click();
                                    document.body.removeChild(downloadLink);
                                    logger("Download pack!")
                                });
                            });
                        }
                    });
                });
            };
            reader.readAsArrayBuffer(blob);
        })
        .catch((error) => {
            logger('Error:', response.status);
        });
}