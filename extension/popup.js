document.getElementById('save').addEventListener('click', function() {
    var saveSuccessfull = false;
    //handle new word for general dictionary
    var csv = document.getElementById('csv').value;
    var wordArray = csv.split(',')
        .map(function(str){ return str.trim().toLowerCase() })
        .filter(function(str){ return str != "" });
    if(wordArray.length > 0){
        chrome.runtime.sendMessage({type: "newWordsForDictionary", words : wordArray});
        saveSuccessfull = true;
    }
    //handle working dictionary
    var toReplace = document.getElementById('to-replace').value.trim();
    var replacement = document.getElementById('replacement').value.trim();
    if (toReplace != "" && replacement != ""){
        chrome.runtime.sendMessage({type: "newWordsForWorkingDictionary", toReplace: toReplace, replacement: replacement});
        saveSuccessfull = true;
    }
    //handle empty imput
    if(!saveSuccessfull) {
        if(toReplace == ""){
            alert('Podajcie co należy poprawić!')
        }else{
            alert('Podajcie na co należy poprawić!')
        }
    }
});
