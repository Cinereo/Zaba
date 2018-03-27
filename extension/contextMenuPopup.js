var toReplace;

// Obtaining word to replace
chrome.runtime.onMessage.addListener(
    function (request, sender, sendResponse) {
        toReplace = request.toReplace.trim();
        document.getElementById("toReplace").innerHTML = toReplace;
    });

// Sending back result
document.getElementById('save').addEventListener('click', function() {
    var replacement = document.getElementById('replacement').value.trim();
    if (replacement != ""){
        chrome.runtime.sendMessage({type: "newWordsForWorkingDictionary", toReplace: toReplace, replacement: replacement});
        window.close();
    } else {
        document.getElementById('replacement').style.borderColor = "red";
    }
});

