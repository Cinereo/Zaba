console.log('Initializing script...');

var dictionary;
var dictionaryPath = 'dictionary.txt';
var tree;
var workingDictionary = {};
const endLinePattern = /\n|\r\n/;
const wordRegex = /^[a-ząęłóźż]+$/i //case-insensitive
const diacriticsMapping = {
    'a': ['ą'],
    'e': ['ę'],
    'o': ['ó'],
    's': ['ś'],
    'l': ['ł'],
    'z': ['ż', 'ź'],
    'x': ['ź'],
    'c': ['ć'],
    'n': ['ń'],

    'ą': ['a'],
    'ę': ['e'],
    'ó': ['o'],
    'ś': ['s'],
    'ł': ['l'],
    'ż': ['z'],
    'ź': ['x', 'z'],
    'ć': ['c'],
    'ń': ['n']
};

function weightedLevenstheinDistance(a, b, diacriticSubstitutionWeight, substitutionWeight, lengthChangeWeight) {
    if (a.length === 0) return b.length * lengthChangeWeight;
    if (b.length === 0) return a.length * lengthChangeWeight;

    var matrix = [];

    // increment along the first column of each row
    var i;
    for (i = 0; i <= b.length; i++) {
        matrix[i] = [i * lengthChangeWeight]
    }

    // increment each column in the first row
    var j;
    for (j = 0; j <= a.length; j++) {
        matrix[0][j] = j * lengthChangeWeight
    }

    // Fill in the rest of the matrix
    for (i = 1; i <= b.length; i++) {
        for (j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1]
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] +
                    (diacriticsMapping[b.charAt(i - 1)] && diacriticsMapping[b.charAt(i - 1)].indexOf(a.charAt(j - 1)) !== -1 ?
                        diacriticSubstitutionWeight
                        : substitutionWeight), // substitution
                    Math.min(matrix[i][j - 1] + lengthChangeWeight, // insertion
                        matrix[i - 1][j] + lengthChangeWeight)) // deletion
            }
        }
    }
    return matrix[b.length][a.length]
}

function readDictionary(onComplete) {
    var startTime = performance.now();
    console.log('Reading dictionary...');
    var req = new XMLHttpRequest();
    req.open('GET', chrome.extension.getURL(dictionaryPath), true);
    req.onreadystatechange = function () {
        if (req.readyState == XMLHttpRequest.DONE && req.status == 200) {
            dictionary = req.responseText.split(endLinePattern);
            var endTime = performance.now();
            console.log('Done reading dictionary. Total words loaded: ' + dictionary.length +
                ' Time spent: ' + (endTime - startTime) + ' milliseconds.');

            buildWordTree(dictionary);
            if(onComplete !== undefined) {
                onComplete();
            }
        }
    };
    req.send();
}

function buildWordTree(dict) {
    console.log('Building word tree...');
    var startTime = performance.now();
    dict.forEach(function (word) {
        // build root of tree
        if (tree === undefined) {
            tree = {word: word, neighbours: {}};
            // build remaining nodes
        } else {
            addWordToTree(word);
        }
    });

    var endTime = performance.now();
    console.log('Done building word tree. Time spent: ' + (endTime - startTime) + ' milliseconds.');
}

function addWordToTree(word) {
    var current = tree;
    var dist = weightedLevenstheinDistance(word, current.word, 1, 3, 5);

    while (current.neighbours[dist] !== undefined) {
        current = current.neighbours[dist];
        dist = weightedLevenstheinDistance(word, current.word, 1, 3, 5);
    }
    if (dist > 0) {
        current.neighbours[dist] = {word: word, neighbours: {}};
    }
}

function isUpperCase(char) {
    return char === char.toUpperCase();
}

function shouldBeCapitalized(word) {
    if (word.length < 2)
        return false;
    if (word.substring(0, 2).toUpperCase() !== word.substring(0, 2)) {
        return false;
    }
    return word.substring(2).toLowerCase() === word.substring(2);
}

function capitalize(word) {
    return word[0].toUpperCase() + word.substring(1).toLowerCase();
}

function setLetterSize(template, word) {
    if (shouldBeCapitalized(template)) {
        return capitalize(word);
    }
    for (var i = 0; i < template.length && i < word.length; i++) {
        if (isUpperCase(template.charAt(i))) {
            word = (i !== 0 ? word.substring(0, i) : "") + word.substring(i).toUpperCase();
        } else {
            word = (i !== 0 ? word.substring(0, i) : "") + word.substring(i).toLowerCase();
        }
    }
    return word;
}

function getSuggestedResolutions(word, root, maxDistance){
    if(workingDictionary[word] != undefined) {
        console.log('Word ' + word + ' found in working dictionary');
        return workingDictionary[word]
            .map(function(word) { return {word: word, distance: 0}; });
    }else if (word.match(wordRegex)){
        return getClosestWords(word, root, maxDistance);
    }else {
        return [];
    }
}

function getClosestWords(word, root, maxDistance) {
    var startTime = performance.now();
    var resultList = [];
    var nodesToVisit = [root];
    var wordLowercase = word.toLowerCase();


    while (nodesToVisit.length !== 0) {
        var current = nodesToVisit.pop();
        var dist = weightedLevenstheinDistance(wordLowercase, current.word, 1, 3, 5);
        if (dist <= maxDistance) {
            resultList.push({
                word: setLetterSize(word, current.word),
                distance: dist
            });
        }

        var min = Math.max(1, dist - maxDistance);
        var max = dist + maxDistance;
        var index = min;
        while (index <= max) {
            if (current.neighbours[index] !== undefined) {
                nodesToVisit.push(current.neighbours[index]);
            }
            index = index + 1;
        }
    }
    resultList.sort(function (a, b) {
        return a.distance - b.distance;
    });
    var endTime = performance.now();
    console.log('Query returned ' + resultList.length + ' results and took: ' + (endTime - startTime) + ' milliseconds');
    return resultList;
}

function addWordToTreeSafely(word) {
    if (isWordCorrectWithAlert(word)) {
        addWordToTree(word);
    }
}

function addToDictionary(toReplace, replacement) {
    console.log('Adding new replacement scheme to working dictionary: (' + toReplace + ' -> ' + replacement + ')' );
    if(isWordCorrectWithAlert(toReplace), isWordCorrectWithAlert(replacement)){
        if(workingDictionary[toReplace] == undefined){
            workingDictionary[toReplace] = [replacement];
        } else {
            var shouldBeAdded = true;
            for (var i = 0; i < workingDictionary[toReplace].length; i++){
                if (workingDictionary[toReplace][i] === replacement){
                    shouldBeAdded = false;
                }
            }
            if (shouldBeAdded) {
                workingDictionary[toReplace].unshift(replacement);
            }
        }
    }
    window.requestFileSystem(window.PERSISTENT, 50*1024*1024 /*50MB*/, updateSerializedDictionary, errorHandlerFs);
}

function updateSerializedDictionary(fs) {
    fs.root.getFile('workingDictionary.txt', {create: true, exclusive: false}, function(fileEntry) {
        fileEntry.file(function(file) {
            var reader = new FileReader();
            reader.onloadend = function(e) {
                fileEntry.createWriter(function(fileWriter) {
                    fileWriter.write(new Blob([JSON.stringify(workingDictionary)], { type: 'plain/text', endings: 'native' }));
                }, errorHandlerFs);
            };
            reader.onerror = errorHandlerFs;
            reader.readAsText(file);
        }, errorHandlerFs);
        console.log(fileEntry.toURL());
    }, errorHandlerFs);
}

function isWordCorrectWithAlert(word){
    if (wordRegex.test(word)) {
        return true;
    } else {
        console.log('Attempted to add incorrect word: "' + word + '"');
        alert('Niepoprawne słowo: "' + word + '". Słowo może składać się tylko z liter!');
        return false;
    }
}

chrome.runtime.onMessage.addListener(
    function (request, sender, sendResponse) {
        switch (request.type) {
            case "newWordDetected":
                console.log('Calculating words closest to "' + request.query + '"');
                var resultList = getSuggestedResolutions(request.query, tree, request.maxLength);
                sendResponse({resultList: resultList});
                break;
            case "newWordsForDictionary":
                console.log('Adding new words to the tree: ' + request.words);
                request.words.forEach(addWordToTreeSafely);
                break;
            case "newWordsForWorkingDictionary":
                addToDictionary(request.toReplace, request.replacement);
                break;
            default:
                console.log('unrecognized message %O', request);
        }
    });

chrome.contextMenus.create({
    title: "Dodaj do słownika",
    contexts: ["selection"],
    onclick: function (selection) {
        word = selection.selectionText.trim();
        console.log('Adding word "' + word + '" to dictionary');
        addWordToTreeSafely(word);
    }
});
chrome.contextMenus.create({
    title: "Zawsze poprawiaj na...",
    contexts: ["selection"],
    onclick: function (selection) {
        toReplace = selection.selectionText.trim();
        chrome.tabs.create({
            url: chrome.extension.getURL('contextMenuPopup.html'),
            active: false
        }, function(tab) {
            chrome.windows.create({
                tabId: tab.id,
                type: 'popup',
                focused: true,
                width: 250,
                height: 150
            }, function(window) {
                //Think of this as a 'constructor argument' for the popup
                chrome.runtime.sendMessage({"toReplace": toReplace});
            });
        });
    }
});

window.requestFileSystem  = window.requestFileSystem || window.webkitRequestFileSystem;
window.requestFileSystem(window.PERSISTENT, 50*1024*1024 /*50MB*/, onInitFs, errorHandlerFs);
function onInitFs(fs) {
    console.log("Opened file system " + fs.name);

    fs.root.getFile('tree.txt', {create: true, exclusive: false}, function(fileEntry) {
        fileEntry.file(function(file) {
            var reader = new FileReader();

            reader.onloadend = function(e) {
                var res = e.target.result;
                if(res.length === 0) { //First time load, so write to file
                    readDictionary(
                        function() {
                            fileEntry.createWriter(function(fileWriter) {
                                fileWriter.onwriteend = function(e) {
                                    console.log("Write complete");
                                };

                                fileWriter.write(new Blob([JSON.stringify(tree)], { type: 'plain/text', endings: 'native' }));
                            }, errorHandlerFs);
                        }
                    );
                } else {
                    console.log("Reading cached word tree...");
                    var startTime = performance.now();
                    tree = JSON.parse(res);
                    var endTime = performance.now();
                    console.log('Done reading cached word tree. Time spent: ' + (endTime - startTime) + ' milliseconds.');
                }
            };
            reader.onerror = errorHandlerFs;

            reader.readAsText(file);
        }, errorHandlerFs);
        console.log(fileEntry.toURL());

    }, errorHandlerFs);

    fs.root.getFile('workingDictionary.txt', {create: true, exclusive: false}, function(fileEntry) {
        fileEntry.file(function(file) {
            var reader = new FileReader();

            reader.onloadend = function(e) {
                var res = e.target.result;
                if(res.length !== 0) {
                    console.log("Reading cached working dictionary...");
                    var startTime = performance.now();
                    workingDictionary = JSON.parse(res);
                    var endTime = performance.now();
                    console.log('Done reading cached working dictionary. Time spent: ' + (endTime - startTime) + ' milliseconds.');
                }
            };
            reader.onerror = errorHandlerFs;

            reader.readAsText(file);
        }, errorHandlerFs);
        console.log(fileEntry.toURL());

    }, errorHandlerFs);
}

function errorHandlerFs(e) {
    var msg = '';

    switch (e.code) {
        case FileError.QUOTA_EXCEEDED_ERR:
            msg = 'QUOTA_EXCEEDED_ERR';
            break;
        case FileError.NOT_FOUND_ERR:
            msg = 'NOT_FOUND_ERR';
            break;
        case FileError.SECURITY_ERR:
            msg = 'SECURITY_ERR';
            break;
        case FileError.INVALID_MODIFICATION_ERR:
            msg = 'INVALID_MODIFICATION_ERR';
            break;
        case FileError.INVALID_STATE_ERR:
            msg = 'INVALID_STATE_ERR';
            break;
        default:
            msg = 'Unknown Error';
            break;
    };

    console.log('Error: ' + msg);
}
