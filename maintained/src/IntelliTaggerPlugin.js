/***
|Name   |IntelliTaggerPlugin|
|Version|1.0.2 (2007-07-25)|
|Source |https://yakovl.github.io/TiddlyWiki_abego/maintained/src/IntelliTaggerPlugin.js|
|Author |Udo Borkowski[[*|https://github.com/abego/YourSearchPlugin/issues/3#issuecomment-2531933217]]|
|Demo   |try view button on a tiddler and click the tags field [[here|https://yakovl.github.io/TiddlyWiki_abego/maintained#%5B%5BBSD%20open%20source%20license%5D%5D]]|
|Documentation|[[IntelliTaggerPlugin Documentation]]|
|Licence|[[BSD open source license (abego Software)]]|
|~CoreVersion|2.0.8|
***/
/***
!Version History
* 1.0.2 (2007-07-25): 
** Feature: "Return" key may be used to accept first tag suggestion (beside "Alt-1")
** Bugfix: Keyboard shortcuts (Alt+3 etc.) shifted
* 1.0.1 (2007-05-18): Improvement: Speedup when using TiddlyWikis with many tags
* 1.0.0 (2006-04-26): Initial release
***/
/***
!Source Code
***/
//{{{
// Ensure the Plugin is only installed once.
//
if (!version.extensions.IntelliTaggerPlugin) {

// Ensure the global abego namespace is set up.
if (!window.abego) window.abego = {};
if (!abego.internal) abego.internal = {};

// Opens an alert with the given string and throws an exception 
// with the same string after the alert is closed.
//
abego.alertAndThrow = function(s) {
    alert(s);
    throw s;
};

if (version.major < 2) {
    abego.alertAndThrow("Use TiddlyWiki 2.0.8 or better to run the IntelliTagger Plugin.");
}

version.extensions.IntelliTaggerPlugin = {
    major: 1, minor: 0, revision: 2,
    date: new Date(2007, 6, 25),
    type: 'plugin',
    source: "https://yakovl.github.io/TiddlyWiki_abego/maintained/src/IntelliTaggerPlugin.js",
    documentation: "[[IntelliTaggerPlugin Documentation]]",
    author: "Udo Borkowski (ub [at] abego-software [dot] de)",
    licence: "[[BSD open source license (abego Software)]]",
    tiddlywiki: "Version 2.0.8 or better"
};
//}}}
//#startOf: MainCode
//{{{
// ========================================================================
// Utilities ==============================================================
// ========================================================================

// ========================================================================
// Popup 
// 
// A Popup is an HTML element floating on top of the main HTML page. 
// 
// The HTML element (typically a "div" element) is added as a direct child 
// of the document.body.
//
// A Popup element should respect the following style conventions:
//
//		position = "absolute";	// required.
//		left = aDimension;		// required. E.g. "10px"
//								// When not defined the Popup is not displayed.
//		top = aDimension;		// required. E.g. "10px"
//								// When not defined the Popup is not displayed.
// 		background = aColor; 	// optional. E.g. "white"
//								// When not defined the Popup is transparent.
// 		border = aBorderSpec;	// optional. E.g. "1px solid DarkGray"
//		width = aDimension;		// optional. E.g. "200px"
//								// When not defined the width is calculated 
//								// automatically.
//		height = aDimension;	// optional. E.g. "200px"
//								// When not defined the height is calculated 
//								// automatically.
// ========================================================================


abego.createEllipsis = function(place) {
    var e = createTiddlyElement(place,"span");
    e.innerHTML = "&hellip;";
};

// Returns true iff the given element is "opened as a popup", 
// i.e. a direct child of the document.body.
//
// @param element [may be null/undefined] 
//				an HTML element
//
abego.isPopupOpen = function(element) {
    return element && element.parentNode == document.body;
};

// Opens the given element as a popup.
// 
// @param element 
//				an HTML element
//
abego.openAsPopup = function(element) {
    if (element.parentNode != document.body)
        document.body.appendChild(element);
};


// Closes the given popup.
// Does nothing when the element is not a popup or not open.
//
// @param element [may be null/undefined] 
//				an HTML element
//
abego.closePopup = function(element) {
    if (abego.isPopupOpen(element)) 
        document.body.removeChild(element);
};

// Returns the rectangle of the (browser) window
//
// @return {left,top,height,width}
// 
abego.getWindowRect = function() {
    return {
        left: findScrollX(),
        top: findScrollY(),
        height: findWindowHeight(),
        width: findWindowWidth()
    };
};

// Moves the given element to the given position (in pixel).
//
abego.moveElement = function(element, left, top) {
    element.style.left = left + "px";
    element.style.top = top + "px";
};

// Centers the given element on the window.
//
// The element must have absolute position
// 
abego.centerOnWindow = function(element) {
    if (element.style.position != "absolute") 
        throw "abego.centerOnWindow: element must have absolute position"; 
        
    var winRect = abego.getWindowRect();

    abego.moveElement(
            element,
            winRect.left + (winRect.width - element.offsetWidth) / 2,
            winRect.top + (winRect.height - element.offsetHeight) / 2);
};

// Returns true if e is either self or a descendant (child, grandchild,...) of self.
//
// @param self DOM:Element
// @param e DOM:Element [may be null]
//
abego.isDescendantOrSelf = function(self, e) {
    while (e) {
        if (self == e) return true;
        e = e.parentNode;
    }
    return false;
};

// Returns a set containing the items of the array. 
// 
// It is an object that has a property for every item of the array.
// The name of the property is the "toString" representation of 
// the item. The value of the property is "true".
//
// Duplicate items are removed.
//
abego.toSet = function(array) {
    var result = {};
    for (var i = 0; i < array.length; i++)
        result[array[i]] = true;
    return result;
};

// Returns an array with all strings from strings that match the filterRE.
//
// @param maxCount [optional] if defined at most maxCount strings are returned.
abego.filterStrings = function(strings, filterRE, maxCount) {
    var result =[];
    for (var i = 0; i < strings.length && (maxCount === undefined || result.length < maxCount); i++) {
        var s = strings[i];
        if (s.match(filterRE)) 
            result.push(s);
    }
    return result;
};

// @param a [may be null/undefined] Object[] 
// @param b [may be null/undefined] Object[] 
abego.arraysAreEqual = function(a,b) {
    if (!a)
        return !b;
    if (!b)
        return false;
        
    var n = a.length;
    if (n != b.length) 
        return false;
    for (var i = 0; i < n; i++) 
        if (a[i] != b[i])
            return false;
    return true;
};

// Adjusts the element's position to appear below the anchorElement, 
// and ensures the element fits into the window.
//
abego.moveBelowAndClip = function(element, anchorElement) {
    if (!anchorElement) 
        return;
    
    // Position the result below the anchor and resize it if necessary.
    var anchorLeft = findPosX(anchorElement);
    var anchorTop = findPosY(anchorElement);
    var anchorHeight = anchorElement.offsetHeight;
    var elementLeft = anchorLeft;
    var elementTop = anchorTop + anchorHeight;

    // Make sure the result is not wider than the window
    var winWidth = findWindowWidth();
    if (winWidth < element.offsetWidth) {
        element.style.width = (winWidth - 100)+"px";
    }

    // Ensure that the left and right of the result are not
    // clipped by the window. Move it to the left or right, if necessary.	
    var elementWidth = element.offsetWidth;
    if(elementLeft + elementWidth > winWidth)
        elementLeft = winWidth - elementWidth-30;
    if (elementLeft < 0) 
        elementLeft = 0;
    
    // Do the actual moving
    element.style.left = elementLeft + "px";
    element.style.top = elementTop + "px";
    element.style.display = "block";
};

abego.compareStrings = function(a, b) {
    return (a == b) ? 0 : (a < b) ? -1 : 1;
};

// Sorts the given array alphabetically, ignoring the case.
//
abego.sortIgnoreCase = function(arr) {
    var result =[];
    
    // To avoid toLowerCase to be called twice for every comparison
    // we convert the strings once and sort the lowercase.
    // After sorting we replace them with the cased ones.
    //
    // Benchmarks have shown that this is significantly faster 
    // than the ad hoc solution, even for small arrays 
    // (like 5 Strings (10 chars each))
    
    var n = arr.length;
    for (var i = 0; i < n; i++) {
        var s = arr[i];
        result.push([s.toString().toLowerCase(),s]);
    }
    result.sort(function(a,b) {
        return (a[0] == b[0]) ? 0 : (a[0] < b[0]) ? -1 : 1;
    });
    
    for (i = 0; i < n; i++) 
        arr[i] = result[i][1];
};

// Returns the specified field (input or textarea element), otherwise the first edit field it finds 
// or null if it found no edit field at all
//
abego.getTiddlerField = function(story,title,field) {
    var tiddler = document.getElementById(story.idPrefix + title);
    var e = null;
    if (tiddler != null)	{
        var children = tiddler.getElementsByTagName("*");
        for (var t=0; t<children.length; t++) {
            var c = children[t];
            if(c.tagName.toLowerCase() == "input" || c.tagName.toLowerCase() == "textarea")	{
                if(!e)
                    e = c;
                if(c.getAttribute("edit") == field)
                    e = c;
                    // break; // adding this break would not be 100% compatible to <= TW 2.0.9. when a 
            }
        }
    }
    return e;
};

abego.setRange = function(element, start, end) {
// adapted from TaskMacroPlugin by LukeBlanshard. 
// http://labwiki.sourceforge.net/#CopyrightAndLicense.
    if (element.setSelectionRange) { // Mozilla
        element.setSelectionRange(start, end);
        // Damn mozilla doesn't scroll to visible.  Approximate.
        var max = 0.0 + element.scrollHeight;
        var len = element.textLength;
        var top = max*start/len, bot = max*end/len;
        element.scrollTop = Math.min(top, (bot+top-element.clientHeight)/2);
    } else if (element.createTextRange != undefined) { // IE
        var range = element.createTextRange();
        range.collapse();
        range.moveEnd("character", end);
        range.moveStart("character", start);
        range.select();
    } else // Other? Too bad, just select the whole thing.
        element.select();
};
                
                
// TiddlerSet: an object with one property per tiddler in the set. 
// The name of the property corresponds to the tiddler name, 
// the value is "not false" (e.g. true or a non-zero number).
//
// TagMap<X>: an object that maps a tag to an object of type X (access through properties)
//
abego.internal.TagManager = function() {
    var tagReferences = null; // TagMap<{count: natural, tiddlers: TiddlerSet}>

    var ensureTagsAreLoaded = function() {
        if (tagReferences)
            return;
            
        tagReferences = {};
        store.forEachTiddler(function(title,tiddler) {
            for(var i=0; i<tiddler.tags.length; i++) {
                var tag = tiddler.tags[i];
                var refedBy = tagReferences[tag];
                if (!refedBy) {
                    refedBy = tagReferences[tag] = {count:0, tiddlers: {}};
                }
                refedBy.tiddlers[tiddler.title] = true;
                refedBy.count += 1;
            }
        });
    };
    
    // When any tags are changed reset the TagManager.
    // 
    var oldTiddlyWikiSaveTiddler = TiddlyWiki.prototype.saveTiddler;
    TiddlyWiki.prototype.saveTiddler = function(title,newTitle,newBody,modifier,modified,tags) {
        var tiddler = this.fetchTiddler(title);
        var oldTags = tiddler ? tiddler.tags : [];
        var newTags = (typeof tags == "string") ? tags.readBracketedList() : tags;

        oldTiddlyWikiSaveTiddler.apply(this, arguments);
        
        if (!abego.arraysAreEqual(oldTags, newTags))
            abego.internal.getTagManager().reset();
    };

    // When a tiddler is removed that had tags reset the TagManager.
    //
    var oldTiddlyWikiRemoveTiddler = TiddlyWiki.prototype.removeTiddler;
    TiddlyWiki.prototype.removeTiddler = function(title) {
        var tiddler = this.fetchTiddler(title);
        var resetTagManager = tiddler && tiddler.tags.length > 0;
        
        oldTiddlyWikiRemoveTiddler.apply(this, arguments);
        
        if (resetTagManager) 
            abego.internal.getTagManager().reset();
    };

    // Resets the TagManager, thus ensures that cached tagging 
    // information is discarded and the most recent tag state is used.
    // 
    this.reset = function () {
        tagReferences = null;
    };
    
    
    // Returns a TiddlerSet with all tiddlers that have the given tag, 
    // or null when the tag is not used in any tiddler.
    //
    // @return [may be null]
    //
    this.getTiddlersWithTag = function(tag) {
        ensureTagsAreLoaded();

        var tagInfo = tagReferences[tag];
        return tagInfo ? tagInfo.tiddlers : null;
    };
    
    // Returns an array with the names of all tags defined 
    // plus the (optional) extraTags. 
    //
    // The tags are sorted alphabetically (caseinsensitive).
    //
    // @params [optional] an array of tags to be added to the list
    //
    //
    this.getAllTags = function(extraTags) {
        ensureTagsAreLoaded();
            
        var result =[];
        for (var i in tagReferences) 
            result.push(i);
            
        for (i = 0; extraTags && i < extraTags.length; i++) 
            result.pushUnique(extraTags[i], true);
            
        abego.sortIgnoreCase(result);
        
        return result;
    };
    
    // An array with two items per tag
    // result[i][0] : the tag name
    // result[i][1] : TiddlerSet, with tiddlers that are tagged with that tag
    // 
    this.getTagInfos = function() {
        ensureTagsAreLoaded();
    
        var result = [];
        for (var tiddler in tagReferences) {
            result.push([tiddler, tagReferences[tiddler]]);
        }
        return result;
    };
    
    var compareTiddlerCountAndTagName = function(a,b) {
            var a1 = a[1];
            var b1 = b[1];
            var d = b[1].count - a[1].count;
            return d != 0 ? d : abego.compareStrings(a[0].toLowerCase(), b[0].toLowerCase());
    };
    
    this.getSortedTagInfos = function() {
        ensureTagsAreLoaded();

        var result = this.getTagInfos();
        
        result.sort(compareTiddlerCountAndTagName);
        
        return result;
    };
    
    // @return an array of the tags that "partner" the activeTags,
    // sorted by the number of conjoint occurances.
    //
    this.getPartnerRankedTags = function(activeTags) {
        var partnerTagCounts = {};
        for (var i = 0; i < activeTags.length; i++) {
            var tiddlersWithTag = this.getTiddlersWithTag(activeTags[i]);
            for (var name in tiddlersWithTag) {
                var tiddler = store.getTiddler(name);
                // It may happen that a tiddler is "gone" in the meantime
                if (!(tiddler instanceof Tiddler)) 
                    continue;
                    
                for(var j=0; j<tiddler.tags.length; j++) {
                    var tag = tiddler.tags[j];
                    var c = partnerTagCounts[tag];
                    partnerTagCounts[tag] = c ? c+1 : 1;
                }
            }
        }
        var currentTagSet = abego.toSet(activeTags);
        var result = [];
        for (var n in partnerTagCounts) {
            if (!currentTagSet[n])
                result.push(n);
        }
        // Sort the tags by their partner tag count, then alphabetically
        result.sort(function (a,b) {
            var d = partnerTagCounts[b] - partnerTagCounts[a];
            return d != 0 ? d : abego.compareStrings(a.toLowerCase(), b.toLowerCase());
        });

        return result;
    };
}; // of abego.internal.TagManager

abego.internal.getTagManager = function() {
    if (!abego.internal.gTagManager) abego.internal.gTagManager = new abego.internal.TagManager();
    return abego.internal.gTagManager;
};

// ========================================================================
// IntelliTagger ==========================================================
// ========================================================================


(function(){
    var PADDING = 2;
    var BORDERWIDTH = 1;
    var MAX_FAVORITE_TAGS = 30;

    var	fSuggestionPopup; // DOM:Element
    var	fAnchorElement; // DOM:Element
    var fOnTagSelected; // function(e) {...}
    var	fSuggestedTags; // [Tag]
    var	fActiveTagSet; // TagSet
    var	fFavoriteTags; // array of Tags, [optional]
    
    if (!abego.IntelliTagger) abego.IntelliTagger = {};

    var getAnchorElement = function() {
        return fAnchorElement;
    };
    
    var isCurrentTag = function(tag) {
        return fActiveTagSet[tag];
    };
    
    var removeLastWord = function(s) {
        var i = s.lastIndexOf(" ");
        return (i >= 0) ? s.substr(0,i) : "";
    };
    
    var lastWordIsFilter = function(inputField) {
        var s = inputField.value;
        var len = s.length;		
        return (len > 0 && s[len-1] != ' ');
    };

    var ensureFieldEndsWithSpace = function(field) {
        var s = field.value;
        var len = s.length;
        if (len > 0 && s[len-1] != ' ') {
            field.value += ' ';
        }
    };
    
    var updateTag = function(tag, inputField, tiddler) {
        if (lastWordIsFilter(inputField)) 
            inputField.value = removeLastWord(inputField.value);
            
        story.setTiddlerTag (tiddler.title,tag,0);
        ensureFieldEndsWithSpace(inputField);
        
        abego.IntelliTagger.assistTagging(inputField, tiddler);
    };
    
    // returns the n-th suggestion, first counting the favorites, then the normal suggestions
    //
    // @param n zero-based.
    // @return [may be null]
    var getNthSuggestion = function(n) {
        if (fFavoriteTags && fFavoriteTags.length > n)
            return fFavoriteTags[n];
        
        return (fSuggestedTags && fSuggestedTags.length > n)
                ? fSuggestedTags[n] 
                : null;
    };

    var useNthSuggestion = function(n, inputField, tiddler) {
        var suggestion = getNthSuggestion(n);
        if (suggestion)
            updateTag(suggestion, inputField, tiddler);
    };


    var getFilter = function(inputField) {
        var pos = inputField.value.lastIndexOf(" ");
        var filter = (pos >= 0) ? inputField.value.substr(++pos,inputField.value.length) : inputField.value;
        return new RegExp(filter.escapeRegExp(),"i");
    };


    var countExpectedTags = function(tags, expectedTagsAsProperties) {
        var result = 0;
        for (var i = 0; i<tags.length;i++) 
            if (expectedTagsAsProperties[tags[i]])
                result++;
        return result;
    };
    
    // Returns the number tags that have the same count of tiddlers
    // as the index-th tagInfo. 
    // 
    // The index-th tag is included in the returned number.
    // 
    // @param sortedTagInfo Array of TagInfos, sorted by count of tiddlers.
    //
    var getNumberOfTagsWithSameCount = function(sortedTagInfos, index, filterRE) {
        var result = 1;
        var c = sortedTagInfos[index];
        for (var i = index+1; i < sortedTagInfos.length; i++) 
            if (sortedTagInfos[i][1].count == c) {
                if (sortedTagInfos[i][0].match(filterRE))
                    result++;
            } else
                break;
        return result;
    };
    
    var getInitialTagSuggestions = function(filterRE, maxCount) {
        var tagInfos = abego.internal.getTagManager().getSortedTagInfos();
        var result =[];
        var lastCount = 0;
        for (var i = 0; i < tagInfos.length; i++) {
            var c = tagInfos[i][1].count;
            
            // Stop adding tags to the result if not all tags with that count of tiddlers would fit into the result.
            if (c != lastCount) {
                if (maxCount && (result.length + getNumberOfTagsWithSameCount(tagInfos, i, filterRE) > maxCount)) 
                    break;
                lastCount = c;
            }
            // Don't add tags that are only used in one tiddler.
            if (c == 1) 
                break;
            var s = tagInfos[i][0];
            if (s.match(filterRE))
                result.push(s);
        }
        return result;
    };
    
    var getAllFilteredTags = function(filterRE, extraTags) {
        return abego.filterStrings(
                abego.internal.getTagManager().getAllTags(extraTags),
                filterRE);
    };

    // Refreshes the tagSuggestions window
    //
    var refreshPopup = function() {
        if (!fSuggestionPopup) 
            return;
    
        // Load the template for the YourSearchResult
        var html = store.getTiddlerText("IntelliTaggerMainTemplate");
        if (!html) 
            html = "<b>Tiddler IntelliTaggerMainTemplate not found</b>";
        fSuggestionPopup.innerHTML = html;
    
        // Expand the template macros etc.
        applyHtmlMacros(fSuggestionPopup,null);
        refreshElements(fSuggestionPopup,null);
    };
    
    var onTagClicked = function(e) {	
        if (!e) var e = window.event;
        var tag = this.getAttribute("tag");
        if (fOnTagSelected)
            fOnTagSelected.call(this,tag, e);
            
        return false;
    };

    var addSeparator = function(place) {
        createTiddlyElement(place,"span",null,"tagSeparator", " | ");
    };
    
    var appendTags = function(place, tags, suggestionIndex, excludeTags, maxCount) {
        if (!tags)
            return;
            
        var excludeTagSet = excludeTags ? abego.toSet(excludeTags) : {};
        var n = tags.length;
        var c = 0;
        for (var i = 0; i < n; i++) {
            var tag = tags[i];
            if (excludeTagSet[tag])
                continue;
                
            if (c > 0) 
                addSeparator(place);
                
            if (maxCount && c >= maxCount) {
                abego.createEllipsis(place);
                break;
            }
            c++;
            
            var shortcutText = "";
            var placeForButton = place;
            if (suggestionIndex < 10) {
                // create a wrapping span that ensures the number and the text are not linebreaked.
                placeForButton = createTiddlyElement(place,"span",null,"numberedSuggestion");
                
                suggestionIndex++;
                var key = suggestionIndex < 10 ? ""+(suggestionIndex) : "0";
                createTiddlyElement(placeForButton,"span",null,"suggestionNumber", key+") ");
                var fastKeyText = suggestionIndex == 1 ? "Return or " : "";
                shortcutText = " (Shortcut: %1Alt-%0)".format([key, fastKeyText]);
            }

            var shiftClickToolTip = config.views.wikified.tag.tooltip.format([tag]);
            var normalClickToolTip = (isCurrentTag(tag) ? "Remove tag '%0'%1" : "Add tag '%0'%1").format([tag,shortcutText]);
            var tooltip = "%0; Shift-Click: %1".format([normalClickToolTip, shiftClickToolTip]);
            var btn = createTiddlyButton(
                    placeForButton,
                    tag,
                    tooltip, 
                    onTagClicked, 
                    isCurrentTag(tag) ? "currentTag" : null);
            btn.setAttribute("tag",tag);
        }
    };
    
    var scrollVisible = function() {
        // Scroll the window to make the fSuggestionPopup page (and the anchorElement) visible.
        if (fSuggestionPopup) window.scrollTo(0,ensureVisible(fSuggestionPopup));
        if (getAnchorElement()) window.scrollTo(0,ensureVisible(getAnchorElement()));
    };

    // Close the suggestions window when the user clicks on the document
    // (and not into the getAnchorElement or in the suggestions window)
    //
    var onDocumentClick = function(e) {
        if (!e) var e = window.event;
        if (!fSuggestionPopup) 
            return;
        
        var target = resolveTarget(e);
        if (target == getAnchorElement()) return; 
        if (abego.isDescendantOrSelf(fSuggestionPopup, target)) return; 
        
        abego.IntelliTagger.close();
    };
    addEvent(document,"click",onDocumentClick);
    
    // We added a space to the tags edit field. To avoid that the 
    // tiddler is marked as "changed" just because of that we trim
    // the field value
    //
    var oldGatherSaveFields = Story.prototype.gatherSaveFields;
    Story.prototype.gatherSaveFields = function(e,fields) {
        oldGatherSaveFields.apply(this, arguments);
        var tags = fields.tags;
        if (tags) 
            fields.tags = tags.trim();
    };
    

    var focusTagsField = function(title) {
        story.focusTiddler(title,"tags");
        var tags = abego.getTiddlerField(story, title, "tags");
        if (tags) {
            var len = tags.value.length;
            abego.setRange(tags, len, len);
            window.scrollTo(0,ensureVisible(tags));
        }
    };
    

    // Attach the assistTagging to the "tags" edit field.
    //
    var oldEditHandler = config.macros.edit.handler;
    config.macros.edit.handler = function(place,macroName,params,wikifier,paramString,tiddler) {
        oldEditHandler.apply(this, arguments);
        var field = params[0];
        if((tiddler instanceof Tiddler) && field == "tags") {
            // Just added the "edit tags" field. 
            // Attach it to the "Tag Suggestions" feature.
            var inputField = place.lastChild;
            inputField.onfocus = function(e) {
                abego.IntelliTagger.assistTagging(inputField, tiddler);
                setTimeout(
                        function() {
                            focusTagsField(tiddler.title);
                        }, 100);

            };
            inputField.onkeyup = function(e) {
                if (!e) var e = window.event;
                if (e.altKey && !e.ctrlKey && !e.metaKey && (e.keyCode >= 48 && e.keyCode <= 57)) {
                    useNthSuggestion(e.keyCode == 48 ? 9 : e.keyCode-49, inputField, tiddler);
                    } else if (e.ctrlKey && e.keyCode == 32) {
                    useNthSuggestion(0, inputField, tiddler);
                } if (!e.ctrlKey && (e.keyCode == 13 || e.keyCode == 10)) {
                    useNthSuggestion(0, inputField, tiddler);
                }
    
                setTimeout(
                    function() {
                        abego.IntelliTagger.assistTagging(inputField, tiddler);
                    }, 100);
                return false;
            };
            
            // ensure that the tags text ends with a space 
            // (otherwise the last word is used as a filter when the field gets the focus)
            ensureFieldEndsWithSpace(inputField);
        }
    };
    
    var onEditTags = function(e) {
        if (!e) var e = window.event;
        var target = resolveTarget(e);
        
        var title = target.getAttribute("tiddler");
        if (title) {
            story.displayTiddler(target,title,"IntelliTaggerEditTagsTemplate", false);
            focusTagsField(title);
        }
        return false;
    };
    
    // Add an "[edit]" button to the "tags" field that is displayed with the tiddler in the ViewTemplate.
    // Pressing the button allows editing the tags only, with the text still being displayed in wikified form.
    //
    var oldTagsHandler = config.macros.tags.handler;
    config.macros.tags.handler = function(place,macroName,params,wikifier,paramString,tiddler) {
        oldTagsHandler.apply(this, arguments);

        abego.IntelliTagger.createEditTagsButton(tiddler, createTiddlyElement(place.lastChild,"li"));
    };
    
    // close the Suggestion Window when the tiddler is no longer edited
    // (i.e. the tag edit inputfield is gone.)
    // 
    // (Note: we must poll this condition since onblur on the input field 
    // cannot be used since every click into the suggestion window results
    // in a lost focus/blur)
    //
    var closeIfAnchorElementIsHidden = function() {
        if (fSuggestionPopup && fAnchorElement && !abego.isDescendantOrSelf(document, fAnchorElement)) 
            abego.IntelliTagger.close();
    };
    setInterval(closeIfAnchorElementIsHidden, 100);
    
//----------------------------------------------------------------------------
// The public API
//----------------------------------------------------------------------------
    
    // @param suggestedTags 
    //				array of strings representing the tags to be suggested.
    //
    // @param activeTags 
    //				array of strings representing the tags currently "active".
    //
    // @param favoriteTags [optional] 
    //				a subset of the suggested tags that are "favorites". 
    //				I.e. They should be presented first etc.
    //
    // @param anchorElement [optional]
    //				when defined the suggestions are displayed "close" to the anchorElement. 
    //				The page is scrolled to make the anchorElement visible.
    //				When the anchorElement is not defined the suggestions are displayed in the
    //				center of the window.
    //
    // @param onTagSelected [optional]
    // 				function(tag, e) to be called when a tag is selected.
    //
    abego.IntelliTagger.displayTagSuggestions = function(suggestedTags, activeTags, favoriteTags, anchorElement, onTagSelected) {
        fSuggestedTags = suggestedTags;
        fActiveTagSet = abego.toSet(activeTags);
        fFavoriteTags = favoriteTags;
        fAnchorElement = anchorElement;
        fOnTagSelected = onTagSelected;
    
        if (!fSuggestionPopup) {
            fSuggestionPopup = createTiddlyElement(document.body,"div",null,"intelliTaggerSuggestions");
            fSuggestionPopup.style.position = "absolute";
        }
    
        refreshPopup();
        abego.openAsPopup(fSuggestionPopup);
        
        if (getAnchorElement()) {
            var w = getAnchorElement().offsetWidth;
            if (fSuggestionPopup.offsetWidth < w) {
                fSuggestionPopup.style.width = (w-2*(PADDING+BORDERWIDTH)) + "px";
            }
            abego.moveBelowAndClip(fSuggestionPopup, getAnchorElement());
        } else {
            abego.centerOnWindow(fSuggestionPopup);
        }

        scrollVisible();
    };
    
    // Shows the Tag Suggestion Popup for the given tiddler, below the specified inputField.
    //
    abego.IntelliTagger.assistTagging = function(inputField, tiddler) {
        var filterRE = getFilter(inputField);
        var s = inputField.value;
        if (lastWordIsFilter(inputField)) 
            s = removeLastWord(s);
        var activeTags = s.readBracketedList();
        var favoriteTags = activeTags.length > 0 
                ? abego.filterStrings(abego.internal.getTagManager().getPartnerRankedTags(activeTags), filterRE, MAX_FAVORITE_TAGS)
                : getInitialTagSuggestions(filterRE, MAX_FAVORITE_TAGS);
        abego.IntelliTagger.displayTagSuggestions(
                getAllFilteredTags(filterRE,activeTags), 
                activeTags,
                favoriteTags, 
                inputField,
                function(tag, e) {
                    if (e.shiftKey) {
                        onClickTag.call(this,e);
                    } else
                        updateTag(tag, inputField, tiddler);
                });
    };
    
    // Closes the Tag Suggestions Popup
    //
    abego.IntelliTagger.close = function() {
        abego.closePopup(fSuggestionPopup);
        fSuggestionPopup = null;
        return false;
    };

    // Creates an TiddlyButton at the given place to edit the tags of the given tiddler.
    //
    abego.IntelliTagger.createEditTagsButton = function(tiddler, place, text, tooltip, className, id, accessKey) {
        if (!text) text = "[edit]";
        if (!tooltip) tooltip = "Edit the tags";
        if (!className) className = "editTags";
        
        var editButton = createTiddlyButton(place,text,tooltip, onEditTags, className, id, accessKey);
        editButton.setAttribute("tiddler", (tiddler instanceof Tiddler) ? tiddler.title : String(tiddler));
        
        return editButton;
    };

    abego.IntelliTagger.getSuggestionTagsMaxCount = function() {
        return 100;
    };
//----------------------------------------------------------------------------
// Macros
//----------------------------------------------------------------------------

// ====Macro intelliTagger ================================================

    config.macros.intelliTagger = {
        // Standard Properties
        label: "intelliTagger",

        handler : function(place,macroName,params,wikifier,paramString,tiddler) {
                        var namesAndValues = paramString.parseParams("list",null, true);
                        var actions = namesAndValues[0]["action"];
                        for (var i = 0; actions && i < actions.length; i++) {
                            var actionName = actions[i];
                            var action = config.macros.intelliTagger.subhandlers[actionName];
                                
                            if (!action) 
                                abego.alertAndThrow("Unsupported action '%0'".format([actionName]));
                                
                            action(place,macroName,params,wikifier,paramString,tiddler);
                        }
                    },
            
        subhandlers: {
            
            showTags : function(place,macroName,params,wikifier,paramString,tiddler) {
                        appendTags(place, fSuggestedTags, fFavoriteTags ? fFavoriteTags.length : 0, fFavoriteTags,abego.IntelliTagger.getSuggestionTagsMaxCount());
                    },
            
            showFavorites : function(place,macroName,params,wikifier,paramString,tiddler) {
                        appendTags(place, fFavoriteTags, 0);
                    },
            
            closeButton : function(place,macroName,params,wikifier,paramString,tiddler) {
                        var button = createTiddlyButton(place, "close", "Close the suggestions", abego.IntelliTagger.close);
                    },

            version : function(place) {
                        var t = "IntelliTagger %0.%1.%2".format(
                                [version.extensions.IntelliTaggerPlugin.major, 
                                    version.extensions.IntelliTaggerPlugin.minor, 
                                    version.extensions.IntelliTaggerPlugin.revision]);
                        var e = createTiddlyElement(place, "a");
                        e.setAttribute("href", "http://tiddlywiki.abego-software.de/#IntelliTaggerPlugin");
                        e.innerHTML = '<font color="black" face="Arial, Helvetica, sans-serif">'+t+'<font>';
                    },

            copyright : function(place) {
                        var e = createTiddlyElement(place, "a");
                        e.setAttribute("href", "http://tiddlywiki.abego-software.de");
                        e.innerHTML = '<font color="black" face="Arial, Helvetica, sans-serif">&copy; 2006-2007 <b><font color="red">abego</font></b> Software<font>';
                    }
        }
    };
    
})();
//}}}

//#endOf: MainCode
//{{{
config.shadowTiddlers["IntelliTaggerStyleSheet"] = 
            "/***\n"+
            "!~IntelliTagger Stylesheet\n"+
            "***/\n"+
            "/*{{{*/\n"+
            ".intelliTaggerSuggestions {\n"+
            "\tposition: absolute;\n"+
            "\twidth: 600px;\n"+
            "\n"+
            "\tpadding: 2px;\n"+
            "\tlist-style: none;\n"+
            "\tmargin: 0;\n"+
            "\n"+
            "\tbackground: #eeeeee;\n"+
            "\tborder: 1px solid DarkGray;\n"+
            "}\n"+
            "\n"+
            ".intelliTaggerSuggestions .currentTag   {\n"+
            "\tfont-weight: bold;\n"+
            "}\n"+
            "\n"+
            ".intelliTaggerSuggestions .suggestionNumber {\n"+
            "\tcolor: #808080;\n"+
            "}\n"+
            "\n"+
            ".intelliTaggerSuggestions .numberedSuggestion{\n"+
            "\twhite-space: nowrap;\n"+
            "}\n"+
            "\n"+
            ".intelliTaggerSuggestions .intelliTaggerFooter {\n"+
            "\tmargin-top: 4px;\n"+
            "\tborder-top-width: thin;\n"+
            "\tborder-top-style: solid;\n"+
            "\tborder-top-color: #999999;\n"+
            "}\n"+
            ".intelliTaggerSuggestions .favorites {\n"+
            "\tborder-bottom-width: thin;\n"+
            "\tborder-bottom-style: solid;\n"+
            "\tborder-bottom-color: #999999;\n"+
            "\tpadding-bottom: 2px;\n"+
            "}\n"+
            "\n"+
            ".intelliTaggerSuggestions .normalTags {\n"+
            "\tpadding-top: 2px;\n"+
            "}\n"+
            "\n"+
            ".intelliTaggerSuggestions .intelliTaggerFooter .button {\n"+
            "\tfont-size: 10px;\n"+
            "\n"+
            "\tpadding-left: 0.3em;\n"+
            "\tpadding-right: 0.3em;\n"+
            "}\n"+
            "\n"+
            "/*}}}*/\n";

config.shadowTiddlers["IntelliTaggerMainTemplate"] = 
            "<!--\n"+
            "{{{\n"+
            "-->\n"+
            "<div class=\"favorites\" macro=\"intelliTagger action: showFavorites\"></div>\n"+
            "<div class=\"normalTags\" macro=\"intelliTagger action: showTags\"></div>\n"+
            "<!-- The Footer (with the Navigation) ============================================ -->\n"+
            "<table class=\"intelliTaggerFooter\" border=\"0\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\"><tbody>\n"+
            "  <tr>\n"+
            "\t<td align=\"left\">\n"+
            "\t\t<span macro=\"intelliTagger action: closeButton\"></span>\n"+
            "\t</td>\n"+
            "\t<td align=\"right\">\n"+
            "\t\t<span macro=\"intelliTagger action: version\"></span>, <span macro=\"intelliTagger action: copyright \"></span>\n"+
            "\t</td>\n"+
            "  </tr>\n"+
            "</tbody></table>\n"+
            "<!--\n"+
            "}}}\n"+
            "-->\n";
            
config.shadowTiddlers["IntelliTaggerEditTagsTemplate"] = 
            "<!--\n"+
            "{{{\n"+
            "-->\n"+
            "<div class='toolbar' macro='toolbar +saveTiddler -cancelTiddler'></div>\n"+
            "<div class='title' macro='view title'></div>\n"+
            "<div class='tagged' macro='tags'></div>\n"+
            "<div class='viewer' macro='view text wikified'></div>\n"+
            "<div class='toolbar' macro='toolbar +saveTiddler -cancelTiddler'></div>\n"+
            "<div class='editor' macro='edit tags'></div><div class='editorFooter'><span macro='message views.editor.tagPrompt'></span><span macro='tagChooser'></span></div>\n"+
            "<!--\n"+
            "}}}\n"+
            "-->\n";

config.shadowTiddlers["BSD open source license (abego Software)"] = "See [[Licence|https://yakovl.github.io/TiddlyWiki_abego/maintained#%5B%5BBSD%20open%20source%20license%5D%5D]].";
config.shadowTiddlers["IntelliTaggerPlugin Documentation"] = "[[Documentation on abego Software website|http://tiddlywiki.abego-software.de/doc/IntelliTagger.pdf]].";
//}}}

//{{{
(function() {
    var oldRestart = restart;
    restart = function() {
setStylesheet(store.getTiddlerText('IntelliTaggerStyleSheet'),'IntelliTaggerStyleSheet');
        oldRestart.apply(this,arguments);
    }
})();

//}}}
            
//{{{
} // of single install
//}}}