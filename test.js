#!/usr/bin/node

"use strict";

var MacroText = require("./macrotext.js");

function defined(obj) {
	return obj !== undefined;
}
function RegExpGroup(m) {
	var index = m.index;
	var str = m[0];
	var pC = 0;
	var groups = m.map(function(s) {
		if (s === undefined) return;
		var p = str.indexOf(s, pC);
		if (p < 0) return;
		pC = p;
		var i = index + p;
		var group = { index: i, string: s };
		return group;
	});
	return groups;
}
var PosMap;
PosMap = function(entries) {
	this.get = function(p) {
		var entry = entries.find(function(entry) {
			var pos = entry.pos;
			var len = entry.len;
			return p >= pos && p < pos + len;
		});
		return entry;
	};
};
PosMap.newSplitLines = function(text) {
	var re = /([^\x0D\x0A]*)(\x0D\x0A|\x0D|\x0A|$)/g;
	var entries = [];
	var row = 0;
	var m;
	while (m = re.exec(text)) {
		var pos = m.index;
		var len = m[2] === "" ? 1 : m[0].length;
		var entry = { pos: pos, len: len, row: row };
		entries.push(entry);
		row++;
		if (m[0].length === 0) {
			re.lastIndex = m.index + 1;
		}
	}
	return new PosMap(entries);
};
function FileReadAllSync(path) {
	var FS = require("fs");
	return FS.readFileSync(path);
}

// var path = process.argv[2] || "test.txt";
// var start = process.argv[3] || -Infinity;
// var end = process.argv[4] || +Infinity;
var path = "test.txt";
var start = process.argv[2] || -Infinity;
var end = process.argv[2] || +Infinity;
var data = FileReadAllSync(path);
var text = data.toString();
var posmap = PosMap.newSplitLines(text);

var regexp = /(===([^\x0D\x0A]*)(?:\x0D\x0A|\x0D|\x0A))([^]*?)(?:\x0D\x0A|\x0D|\x0A)---(?:\x0D\x0A|\x0D|\x0A)([^]*?)(?:\x0D\x0A|\x0D|\x0A)---(?:\x0D\x0A|\x0D|\x0A)/g;
var entries = [];
var m;
while (m = regexp.exec(text)) {
	var title = m[2];
	var input = m[3];
	var output = m[4];
	var position = m.index + m[1].length;
	title = title.replace(/^\s*|\s*$/g, "");
	var index = entries.length + 1;
	var entry = { index: index, title: title, input: input, output: output, filepath: path, position: position };
	entries.push(entry);
}
// console.log(entries);

var callback = function(code, src, getMsg) {
	var type = MacroText.getMessageType(code);
	if (type === "Debug") {
		return;
	}
	var entry = src.tag;
	var file = defined(entry.filepath) ? entry.filepath : "-";
	var pos = entry.position + src.pos;
	var r = posmap.get(pos);
	var row = r.row + 1;
	var col = pos - r.pos + 1;
	var msg = getMsg();
	console.log("%s:%s:%s:%s: %s", file, row, col, type, msg);
};
// entries = entries.filter(function(entry) {
// 	return entry.index >= start && entry.index <= end;
// });
var failed = false;
var failedEntries = [];
entries.forEach(function(entry) {
	var index = entry.index;
	if (!(index >= start && index <= end)) {
		return;
	}
	var title = entry.title;
	var input = entry.input;
	var outputCorrect = entry.output;
	console.log("test", index, title);
	var mt = MacroText.create({ allowSystem: true, callback: callback });
	var node = mt.parse(input, entry);
	var value = mt.evaluate(node);
	var output = value.toString();
	var success = output === outputCorrect;
	if (success) {
		console.log("OK", index, title);
	} else {
		console.log("NG", index, title);
		console.log(input);
		console.log(output);
		console.log(outputCorrect);
		failed = true;
		failedEntries.push(entry);
	}
});
if (failed) {
	console.log("NG", failedEntries.length);
	failedEntries.forEach(function(entry) {
		console.log(entry.index, entry.title);
	});
} else {
	console.log("OK all");
}
