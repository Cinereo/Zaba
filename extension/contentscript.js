var refreshIntervalSeconds = 2000;
var anyNonSpecialCharacterDetected = false;
const separatorIndicators = ["Enter", "Tab", " ", ".", ",", ";", ":", "\"", "'", "?", "!"];
const separatorValues = ["\n", "\t", " ", ".", ",", ";", ":", "\"", "'", "?", "!"];

var inIterationState = false;
var iterationObject = {
    sentenceToTheLeft: "",
    sentenceToTheRight: "",
    obj: null,
    oldClassName: "",
    oldTitle: "",
    oldDataToggle: "",
    oldDataPlacement: "",
    wordList: [],
    script: null
};

console.log("Content script loaded");

$(document).ready(function() {

    var jquery = document.createElement('script');
    jquery.src += chrome.extension.getURL('jquery-3.2.1.min.js');


    (document.head || document.documentElement).appendChild(jquery);


    var s = document.createElement('script');
    s.src = chrome.extension.getURL('bootstrap.min.js');
    s.async = false;
    (document.head || document.documentElement).appendChild(s);

    var l = document.createElement('link');
    l.rel = chrome.extension.getURL('bootstrap.min.css');

    (document.head || document.documentElement).appendChild(l);

});

function clearIterationObject() {
    iterationObject.sentenceToTheLeft = "";
    iterationObject.sentenceToTheRight = "";
    iterationObject.obj = null;
    iterationObject.oldClassName = "";
    iterationObject.oldTitle = "";
    iterationObject.oldDataToggle = "";
    iterationObject.oldDataPlacement = "";
    iterationObject.wordList = [];
    iterationObject.script = null;

}

function quitIterationState() {

    var script = document.createElement('script');
    script.textContent = "$('.tool_tip_zaba').tooltip('destroy');";
    (document.head || document.documentElement).appendChild(script);

    iterationObject.obj.className = iterationObject.oldClassName;
    iterationObject.obj.oldTitle = iterationObject.oldTitle;
    iterationObject.obj.setAttribute("data-toggle", iterationObject.oldDataToggle);
    iterationObject.obj.setAttribute("data-placement", iterationObject.oldDataPlacement);
    iterationObject.script.remove();
    clearIterationObject();

    script.remove();

    inIterationState = false;
}


function separatorIndicatorToValue(ind) {
    if (ind === "Enter") {
        return "\n";
    }
    if (ind === "Tab") {
        return "\t";
    }
    return ind;
}

function isEndOfWord(pressedKey) {
    return separatorIndicators.indexOf(pressedKey) !== -1;
}

function findFirstLetterIndex(sentence, lastLetterIndex) {
    var ifAnyNotSeparator = false;
    for(var i = lastLetterIndex; i>=0; i--) {
        if ($.inArray(sentence[i], separatorValues) !== -1 && ifAnyNotSeparator) {
            return i+1;
        } else if ($.inArray(sentence[i], separatorValues) === -1) {
            ifAnyNotSeparator = true;
        }
    }
    return 0;
}

function putNumberBeforeEachWord(list) {
    var result = "";
    list.slice(0, 9).forEach(function(value, idx) {
        result += idx+1 + ":" + value.word + ", ";
    });
    return result;
}

function handleNextWord(sentence, usedSeparator, obj) {

    // get cursor position after typing special character
    var cursorPosition = obj.selectionStart;
    // count index of first letter in already typed word
    var firstLetterIndex = findFirstLetterIndex(sentence, cursorPosition-1);
    // extract already typed word
    var word = sentence.substring(firstLetterIndex, cursorPosition);
    console.log("Detected new word \"" + word + "\"");

    chrome.runtime.sendMessage({type: "newWordDetected", query: word, maxLength: 6}, function(response) {
        if(response.resultList.length > 0) {
            var title = putNumberBeforeEachWord(response.resultList);
            var script = document.createElement('script');
            script.textContent = "$('.tool_tip_zaba').tooltip({trigger:'manual'}).tooltip('show');";

            iterationObject.sentenceToTheLeft = sentence.substring(0, firstLetterIndex);
            iterationObject.sentenceToTheRight = separatorIndicatorToValue(usedSeparator) + sentence.substring(firstLetterIndex+word.length);
            iterationObject.obj = obj;
            iterationObject.wordList = response.resultList;
            iterationObject.oldClassName = obj.className;
            iterationObject.oldTitle = obj.title;
            iterationObject.oldDataToggle = obj.getAttribute("data-toggle");
            iterationObject.oldDataPlacement = obj.getAttribute("data-placement");
            iterationObject.script = script;

            obj.className += ' tool_tip_zaba';
            obj.title = title;
            obj.setAttribute("data-toggle", "tooltip");
            obj.setAttribute("data-placement", "bottom");

            (document.head || document.documentElement).appendChild(script);
            inIterationState = true;

            // obj.value = sentence.substring(0, firstLetterIndex) + response.resultList[0].word + separatorIndicatorToValue(usedSeparator);

        }
    });
}

function findInputs() {
    $("input[type='text'], textarea, div[contenteditable='true'], span[contenteditable='true'],p[contenteditable='true'],[spellcheck='true']").each(
        function (index) {
            if ($(this).data('isAutocorrectEnabled') !== true) {
                $(this).data('isAutocorrectEnabled', true);
                $(this).bind("keypress", function (event) {
                    var content = $.trim($(this).val());

                    if (inIterationState) {
                        if (this !== iterationObject.obj) {  // User is in different text box
                            quitIterationState();
                        }
                        else if (/\d/.test(event.key)) {
                            var NumberIndex = +event.key - 1;
                            if (NumberIndex < iterationObject.wordList.length) {
                                if (NumberIndex >= 0) { // If zero was pressed, do not change any word, but quit iteration state.
                                    iterationObject.obj.value = iterationObject.sentenceToTheLeft + iterationObject.wordList[NumberIndex].word + iterationObject.sentenceToTheRight;
                                    var indexAfterWord = iterationObject.sentenceToTheLeft.length + iterationObject.wordList[NumberIndex].word.length + 1;
                                    iterationObject.obj.setSelectionRange(indexAfterWord, indexAfterWord);
                                }
                                quitIterationState();
                                event.preventDefault();
                                return
                            }
                        } else { // Pressed sign was not a number, so we change the word to the first proposed correction if exists.
                            var NumberIndex = 0;
                            iterationObject.obj.value = iterationObject.sentenceToTheLeft + iterationObject.wordList[NumberIndex].word
                                + iterationObject.sentenceToTheRight + separatorIndicatorToValue(event.key);
                            var indexAfterWord = iterationObject.sentenceToTheLeft.length + iterationObject.wordList[NumberIndex].word.length + 1;
                            // Here indexAfterWord + 1, because we want to be right after the pressed non numeric sing.
                            iterationObject.obj.setSelectionRange(indexAfterWord + 1, indexAfterWord + 1);
                            quitIterationState();
                            event.preventDefault();
                            return
                        }
                    }

                    if (isEndOfWord(event.key)) {
                        if (anyNonSpecialCharacterDetected) {
                            anyNonSpecialCharacterDetected = false;
                            /*
                             User may start writing new word before noticing iteration state tooltip, so keep the iteration state for as long as possible -
                             that is, to the moment when new word is detected.
                             */
                            if(inIterationState) {
                                quitIterationState();
                            }
                            handleNextWord(content, event.key, this);
                        }
                    }
                    else {
                        if (inIterationState) {
                            iterationObject.sentenceToTheRight += event.key;
                        }
                        anyNonSpecialCharacterDetected = true;
                        console.log("Not end of word");
                        console.log(event.key);
                    }
                });
            }
        }
    );
}

findInputs();
setInterval(findInputs, refreshIntervalSeconds);
