
//
// macro text
// \set_list{a}{1 2}\join{:}{\map{\add{\_}{2}}{\a}}
// -> \set_list{ a }{ 1 2 } \join{ : }{ \map{ \add{ \_ }{ 2 } }{ \a } }
// -> \join{ : }{ \map{ \add{ \_ }{ 2 } }{ 1 2 } }
// -> \join{ : }{ \add{ 1 }{ 2 } \add{ 2 }{ 2 } }
// -> \join{ : }{ 3 4 }
// -> 3:4
//

(function(global) {
"use strict";

function defined(obj) {
	return obj !== undefined;
}
function newClass(parent, constructor) {
	var c = constructor;
	c.prototype = Object.create(parent.prototype);
	return c;
}
var Reflect = global.Reflect || {};
Reflect.construct = Reflect.construct || function(target, argumentsList) {
	return new (target.bind.apply(target, [null].concat(argumentsList)))();
};
Array.from = Array.from || function(arrayLike) {
	var array = [];
	Array.prototype.push.apply(array, arrayLike);
	return array;
}
Array.concat = function() {
	return Array.prototype.concat.apply([], arguments);
};
Array.prototype.allnext = function(condition, self) {
	var array = this;
	for (var i = 0; i + 1 < array.length; i++) {
		var a = array[i];
		var b = array[i + 1];
		if (!condition.call(self, a, b)) {
			return false;
		}
	}
	return true;
};
Array.prototype.alltwo = function(condition, self) {
	var array = this;
	for (var i = 0; i < array.length; i++) {
		for (var j = i + 1; j < array.length; j++) {
			var a = array[i];
			var b = array[j];
			if (!condition.call(self, a, b)) {
				return false;
			}
		}
	}
	return true;
};
Array.prototype.find = Array.prototype.find || function(callback, self) {
	var array = this;
	for (var i = 0; i < array.length; i++) {
		var element = array[i];
		var b = callback.call(self, element, i, array);
		if (b) {
			return element;
		}
	}
	return undefined;
};
function KvlistForEach(kvlist, callback, self) {
	var index = 0;
	for (var i = 0; i + 1 < kvlist.length; i += 2) {
		var key = kvlist[i];
		var value = kvlist[i + 1];
		callback.call(self, key, value, index, kvlist);
		index++;
	}
}
Object.assign = Object.assign || function(target) {
	for (var i = 1; i < arguments.length; i++) {
		var source = arguments[i];
		for (var key in source) {
			var value = source[key];
			target[key] = value;
		}
	}
	return target;
};
Object.clone = function(obj) {
	var obj2 = {};
	Object.assign(obj2, obj);
	return obj2;
};
Object.merge = function() {
	var obj = {};
	Array.prototype.unshift.call(arguments, obj);
	Object.assign.apply(null, arguments);
	return obj;
};
Object.forEach = function(obj, callback, self) {
	for (var key in obj) {
		var value = obj[key];
		callback.call(self, key, value, obj);
	}
};
Object.map = function(obj, callback, self) {
	var obj2 = {};
	for (var key in obj) {
		var value = obj[key];
		var value2 = callback.call(self, value, key, obj);
		obj2[key] = value2;
	}
	return obj2;
};
Number.isNaN = Number.isNaN || isNaN;
Number.parseInt = Number.parseInt || parseInt;
Number.parseFloat = Number.parseFloat || parseFloat;
function StringFormatList(format, args) {
	var str = format.replace(/(\$(\$|[0-9]+))/g, function(match, s, a) {
		var s2;
		return (
			a == "\$" ? a :
			(s2 = args[a - 1]) !== undefined ? s2 :
			s
		);
	});
	return str;
}
function evalExpr(expr, args) {
	var $_ = args;
	return eval(expr);
}

var messageTypes = {
	TOKEN: "Debug",
	LITTLEVME: "Warning",
	EXCESSVME: "Warning",
	LITTLEME: "Warning",
	EXCESSME: "Warning",
	MACRO: "Debug",
	NOMACRO: "Warning",
	EXCESSARGS: "Info",
	LITTLEARGS: "Warning",
	NOMODULE: "Warning",
	MESSAGE: "Message",
};
var messagesC = {
	TOKEN: "token $1",
	LITTLEVME: "no end to \\$1",
	EXCESSVME: "too many $1",
	LITTLEME: "too few }",
	EXCESSME: "too many }",
	MACRO: "macro $1",
	NOMACRO: "undefined macro $1",
	EXCESSARGS: "too many arguments to macro $1, expected $2, have $3",
	LITTLEARGS: "too few arguments to macro $1, required $2, have $3",
	NOMODULE: "no module $1",
	MESSAGE: "message $1",
};
function fireCallback(callback, code, src, args) {
	if (typeof callback !== "function") return;
	var getMsg = function() {
		var format = messagesC[code];
		var msg = StringFormatList(format, args);
		return msg;
	};
	callback(code, src, getMsg);
}

// parse
// var peg = `
// mtext = (macro / block / verbatim / escape / text)*
// macro = "\\\\" "@"? [a-zA-Z0-9_]+ (whitespace* arg)*
// block = arg (whitespace* arg)*
// arg = "{" mtext "}"
// verbatim = "\\\\@{" (!"\\\\@}" .)* "\\\\@}"
// escape = "\\\\" [^@a-zA-Z0-9_]
// whitespace = [ \\t\\n\\r\\f]
// text = [^\\\\{}]+
// `;

// node
var Src = function(tag, pos, len) {
	this.tag = tag;
	this.pos = pos;
	this.len = len;
};
var Node = function(src) {
	this.src = src;
	this.value;
	// this.value = undefined;
};
Node.prototype.toString = function() {
	return printNode(this);
};
var NodeTopLevel = newClass(Node, function(src, nodes) {
	Node.call(this, src);
	this.nodes = nodes;
});
var NodeSkippedEOL = newClass(Node, function(src, eol) {
	Node.call(this, src);
	this.eol = eol;
});
var NodeLineComment = newClass(Node, function(src, line, flag, eol) {
	Node.call(this, src);
	this.line = line;
	this.flag = flag;
	this.eol = eol;
});
var NodeBlockComment = newClass(Node, function(src, str, flag, lack) {
	Node.call(this, src);
	this.str = str;
	this.flag = flag;
	this.lack = lack;
});
var NodeVerbatim = newClass(Node, function(src, str, flag, lack) {
	Node.call(this, src);
	this.str = str;
	this.flag = flag;
	this.lack = lack;
});
var NodeMacro = newClass(Node, function(src, command, args) {
	Node.call(this, src);
	this.command = command;
	this.args = args;
});
var NodeArg = newClass(Node, function(src, nodes, spacing, lack) {
	Node.call(this, src);
	this.nodes = nodes;
	this.spacing = spacing;
	this.lack = lack;
});
var NodeCharRef = newClass(Node, function(src, str, s) {
	Node.call(this, src);
	this.str = str;
	this.s = s;
});
var NodeEscaped = newClass(Node, function(src, str) {
	Node.call(this, src);
	this.str = str;
});
var NodeString = newClass(Node, function(src, str) {
	Node.call(this, src);
	this.str = str;
});

// parse(text: String, callback: MTCallback, tag: any): NodeTopLevel
function parse(text, callback, tag) {
	function newSrc(pos, len) {
		return new Src(tag, pos, len);
	}
	// var lexer = /\\(?:\x0D\x0A|\x0D|\x0A|$)|\\@\{|\\@\}|\\@?\w+(?:\s*\{)?|\{|\}(?:\s*\{)?|\\.|[^\\\{\}]+/g;
	var lexer = /\\(?:\x0D\x0A|\x0D|\x0A|$)|\\\/+[^]*?(?:\x0D\x0A|\x0D|\x0A|$)|\\!\{[^]*?(?:\\!\}|$)|\\!\}|\\(`+)[^]*?(?:\1|$)|\\@\{[^]*?(?:\\@\}|$)|\\@\}|\\(?:\+|-|=|%|\^|&|\*|@\w+|!\w+|\?\w+|\w+)(?:\s*\{)?|\{|\}(?:\s*\{)?|\\#[0-9]+|\\#x[0-9a-fA-F]+|\\[^]|[^\\\{\}]+/g;
	var nodesRoot = [];
	var macrolistS = [];
	function addNode(node) {
		// Object.freeze(node);
		// Object.seal(node);
		// Object.preventExtensions(node);
		var nodesC = macrolistS.length > 0 ? macrolistS[macrolistS.length - 1].arg.nodes : nodesRoot;
		nodesC.push(node);
	}
	function beginMacro(start, command) {
		var macro = { start: start, command: command, args: [] };
		var macrolist = { macro: macro, arg: null };
		macrolistS.push(macrolist);
	}
	function endMacro(end) {
		var macrolist = macrolistS.pop();
		var macro = macrolist.macro;
		var start = macro.start;
		var src = newSrc(start, end - start);
		addNode(new NodeMacro(src, macro.command, macro.args));
	}
	function beginArg(start, spacing) {
		var arg = { start: start, spacing: spacing, nodes: [] };
		var macrolist = macrolistS[macrolistS.length - 1];
		macrolist.arg = arg;
	}
	function endArg(end, lack) {
		var macrolist = macrolistS[macrolistS.length - 1];
		if (!macrolist) {
			return "EXCESSME";
		}
		var macro = macrolist.macro;
		var arg = macrolist.arg;
		var start = arg.start;
		var src = newSrc(start, end - start);
		macro.args.push(new NodeArg(src, arg.nodes, arg.spacing, lack));
		macrolist.arg = null;
	}
	var m;
	while (m = lexer.exec(text)) {
		var pos = m.index;
		var str = m[0];
		var len = str.length;
		var src = newSrc(pos, len);
		fireCallback(callback, "TOKEN", src, [str]);
		if (m = str.match(/^\\(\x0D\x0A|\x0D|\x0A|$)$/)) {
			addNode(new NodeSkippedEOL(src, m[1]));
		} else if (m = str.match(/^\\(\/+)([^]*?)(\x0D\x0A|\x0D|\x0A|$)$/)) {
			addNode(new NodeLineComment(src, m[2], m[1], m[3]));
		} else if (m = str.match(/^\\(!\{)([^]*?)(\\!\}|$)/)) {
			var lack = m[3] === "";
			addNode(new NodeBlockComment(src, m[2], m[1], lack));
			if (lack) {
				fireCallback(callback, "LITTLEVME", src, [m[1]]);
			}
		} else if (str === "\\!\}") {
			fireCallback(callback, "EXCESSVME", src, ["\\!\}"]);
		} else if (m = str.match(/^\\(`+)([^]*?)(\1|$)/)) {
			// scalar in vervatime mode
			var lack = m[3] === "";
			addNode(new NodeVerbatim(src, m[2], m[1], lack));
			if (lack) {
				fireCallback(callback, "LITTLEVME", src, [m[1]]);
			}
		} else if (m = str.match(/^\\(@\{)([^]*?)(\\@\}|$)/)) {
			// scalar in vervatime mode
			var lack = m[3] === "";
			addNode(new NodeVerbatim(src, m[2], m[1], lack));
			if (lack) {
				fireCallback(callback, "LITTLEVME", src, [m[1]]);
			}
		} else if (str === "\\@\}") {
			fireCallback(callback, "EXCESSVME", src, ["\\@\}"]);
		} else if (m = str.match(/^\\(\+|-|=|%|\^|&|\*|@\w+|!\w+|\?\w+|\w+)((\s*)(\{))?$/)) {
			// macro
			beginMacro(pos, m[1]);
			if (defined(m[2])) {
				beginArg(pos + len, m[3]);
			} else {
				endMacro(pos + len);
			}
		} else if (str === "\{") {
			// block macro
			beginMacro(pos, "");
			beginArg(pos + len, "");
		} else if (m = str.match(/^(\})((\s*)(\{))?$/)) {
			// end arg
			if (endArg(pos)) {
				// too many }
				var src1 = newSrc(pos, m[1].length);
				fireCallback(callback, "EXCESSME", src1, []);
				if (defined(m[2])) {
					// spaces
					var pos3 = pos + m[1].length;
					var src3 = newSrc(pos3, m[3].length);
					addNode(new NodeString(src3, m[3]));
					// block macro
					var pos4 = pos + len - m[4].length;
					beginMacro(pos4, "");
					beginArg(pos + len, "");
				}
				continue;
			}
			if (defined(m[2])) {
				beginArg(pos + len, m[3]);
			} else {
				endMacro(pos + len);
			}
		} else if (m = str.match(/^\\(#([0-9]+))$/)) {
			var str = String.fromCharCode(Number.parseInt(m[2], 10));
			addNode(new NodeCharRef(src, str, m[1]));
		} else if (m = str.match(/^\\(#x([0-9a-fA-F]+))$/)) {
			var str = String.fromCharCode(Number.parseInt(m[2], 16));
			addNode(new NodeCharRef(src, str, m[1]));
		} else if (m = str.match(/^\\([^])$/)) {
			// escape
			addNode(new NodeEscaped(src, m[1]));
		} else if (m = str.match(/^([^\\\{\}]+)$/)) {
			// string
			addNode(new NodeString(src, m[1]));
		} else {
			throw "PARSEERROR";
		}
	}
	if (macrolistS.length > 0) {
		var src = newSrc(0, text.length);
		fireCallback(callback, "LITTLEME", src, []);
		while (macrolistS.length > 0) {
			endArg(text.length, true);
			endMacro(text.length);
		}
	}
	var root = new NodeTopLevel(newSrc(0, text.length), nodesRoot);
	return root;
}
function printNode(node) {
	var str = "";
	function sub(node) {
	if (node instanceof NodeTopLevel) {
		var nodes = node.nodes;
		nodes.forEach(function(node) {
			sub(node);
		});
	} else if (node instanceof NodeSkippedEOL) {
		var eol = node.eol;
		str += "\\" + eol;
	} else if (node instanceof NodeLineComment) {
		var line = node.line;
		var flag = node.flag;
		var eol = node.eol;
		str += "\\" + flag + line + eol;
	} else if (node instanceof NodeBlockComment) {
		var s = node.str;
		var flag = node.flag;
		var lack = node.lack;
		str += "\\!\{" + s + "\\!\}";
	} else if (node instanceof NodeVerbatim) {
		var s = node.str;
		var flag = node.flag;
		var lack = node.lack;
		if (flag === "@{") {
			str += "\\@\{" + s + "\\@\}";
		} else {
			str += "\\" + flag + s + flag;
		}
	} else if (node instanceof NodeMacro) {
		var command = node.command;
		var args = node.args;
		str += command === "" ? "" : "\\" + command;
		args.forEach(function(arg) {
			var spacing = arg.spacing;
			var lack = arg.lack;
			// str += spacing;
			str += "{"
			sub(arg);
			str += "}";
		});
	} else if (node instanceof NodeArg) {
		var nodes = node.nodes;
		nodes.forEach(function(node) {
			sub(node);
		});
	} else if (node instanceof NodeCharRef) {
		var s = node.s;
		str += "\\" + s;
	} else if (node instanceof NodeEscaped) {
		var s = node.str;
		str += "\\" + s;
	} else if (node instanceof NodeString) {
		var s = node.str;
		str += s;
	}
	}
	sub(node);
	return str;
}

// value
var Value = function(src, v) {
	this.src = src;
	this.v = v;
};
var ValueSequence = function(src, values) {
	this.src = src;
	this.values = values;
};
Value.prototype.toString = function() {
	return printValue(this);
};
ValueSequence.prototype.toString = function() {
	return printValue(this);
};
function forEachValue(v, callback, self) {
	function sub(v) {
	if (v instanceof Value) {
		var value = v;
		var v = value.v;
		sub(v);
	} else if (v instanceof ValueSequence) {
		var vs = v;
		var values = vs.values;
		values.forEach(function(value) {
			sub(value);
		});
	} else {
		var o = v;
		callback.call(self, o);
	}
	}
	sub(v);
}
function printValue(v) {
	var str = "";
	function sub(v) {
	if (v instanceof Value) {
		var value = v;
		var v = value.v;
		sub(v);
	} else if (v instanceof ValueSequence) {
		var vs = v;
		var values = vs.values;
		values.forEach(function(value) {
			sub(value);
		});
	} else if (v instanceof Node) {
		var node = v;
		var s = printNode(node);
		str += "\\%{" + s + "}";
	} else if (isNull(v)) {
	} else if (isBoolean(v)) {
		var b = v;
		str += b ? "\\+" : "\\-";
	} else if (isNumber(v)) {
		var num = v;
		str += "\\={" + num.toString(10) + "}";
	} else if (isString(v)) {
		var s = v;
		var s2 = s.replace(/(\\|{|})/g, "\\$1");
		str += s2;
	} else if (isFunction(v)) {
		str += "\\^";
	} else if (isList(v)) {
		var list = v;
		str += "\\&";
		list.forEach(function(item) {
			str += "{";
			sub(item);
			str += "}";
		});
	} else if (isDict(v)) {
		var dict = v;
		var keys = Object.keys(dict);
		keys = keys.sort();
		str += "\\*";
		keys.forEach(function(key) {
			var value = dict[key];
			str += "{";
			str += key;
			str += "}{";
			sub(value);
			str += "}";
		});
	} else {
		str += "\\!\n";
	}
	}
	sub(v);
	return str;
}

function isNull(v) {
	return v === undefined || v === null;
}
function isBoolean(v) {
	return typeof v === "boolean";
}
function isNumber(v) {
	return typeof v === "number";
}
function isString(v) {
	return typeof v === "string";
}
function isFunction(v) {
	return typeof v === "function";
}
function isList(v) {
	return v !== undefined && v !== null && Object.getPrototypeOf(v) === Array.prototype;
}
function isDict(v) {
	return v !== undefined && v !== null && Object.getPrototypeOf(v) === Object.prototype;
}
function isNode(v) {
	return v instanceof Node;
}

// macro

// evaluate(node: Node, mt: MacroText, callback: MTCallback, hook: function): Value
function checkEvalueted(node) {
	if (!defined(node)) {
		return true;
	} else if (node instanceof Array) {
		var nodes = node;
		return nodes.every(function(node) {
			return defined(node.value);
		});
	} else {
		return defined(node.value);
	}
}
// var count = 0;
function evaluate(node, mt, callback, hook) {
	if (checkEvalueted(node)) {
		// console.log(count++);
		return node.value;
	}
	function evalNodelist(node) {
		var nodes = node.nodes;
		var values = nodes.map(function(node) {
			return evaluate(node, mt, callback);
		});
		var value = new ValueSequence(node.src, values);
		if (checkEvalueted(nodes)) {
			node.value = value;
		}
		return value;
	}
	if (node instanceof NodeTopLevel) {
		var value = evalNodelist(node);
		return value;
	} else if (node instanceof NodeSkippedEOL || node instanceof NodeLineComment || node instanceof NodeBlockComment) {
		var value = new Value(node.src, undefined);
		node.value = value;
		return value;
	} else if (node instanceof NodeString || node instanceof NodeVerbatim || node instanceof NodeCharRef || node instanceof NodeEscaped) {
		var str = node.str;
		var value = new Value(node.src, str);
		node.value = value;
		return value;
	} else if (node instanceof NodeMacro) {
		return evalMacroCall(node, mt, callback);
	} else if (node instanceof NodeArg) {
		var nodes = node.nodes;
		var macros = mt.saveMacros();
		if (typeof hook === "function") {
			hook(mt, node);
		}
		var value = evalNodelist(node);
		mt.restoreMacros(macros);
		return value;
	}
}
function evalMacroCall(node, mt, callback) {
	// (\+|-|=|%|\^|&|\*|@\w+|!\w+|\?\w+|\w+)
	var command = node.command;
	var args = node.args;
	fireCallback(callback, "MACRO", node.src, [command]);
	var m, r;
	if (command === "") {
		var values = args.map(function(arg) {
			return evaluate(arg, mt, callback);
		});
		var value = new ValueSequence(node.src, values);
		if (checkEvalueted(args)) {
			node.value = value;
		}
		return value;
	} else if (command === "+") {
		var value = new Value(node.src, true);
		node.value = value;
		return value;
	} else if (command === "-") {
		var value = new Value(node.src, false);
		node.value = value;
		return value;
	} else if (command === "=") {
		var arg = args[0];
		var r = defined(arg) ? getNumber(evaluate(arg, mt, callback)) : 0;
		var value = new Value(node.src, r);
		if (checkEvalueted(arg)) {
			node.value = value;
		}
		return value;
	} else if (command === "%") {
		var arg = args[0];
		var value = new Value(node.src, arg);
		return value;
	} else if (command === "^") {
		var func = function() { };
		var value = new Value(node.src, func);
		return value;
	} else if (command === "&") {
		var list = args.map(function(arg) {
			return evaluate(arg, mt, callback);
		});
		var value = new Value(node.src, list);
		return value;
	} else if (command === "*") {
		var values = args.map(function(arg) {
			return evaluate(arg, mt, callback);
		});
		var dict = {};
		KvlistForEach(values, function(keyV, valueV) {
			var key = getString(keyV);
			dict[key] = valueV;
		});
		return dict;
	} else if (m = command.match(/^@(\w+)$/)) {
		var name = m[1];
		if (defined(r = getRMacro(mt, name))) {
			var rmacro = r.rmacro;
			var argument = r.argument;
			return evalRMacro(rmacro, argument, name, args, node, mt, callback);
		}
	} else if (m = command.match(/^!(\w+)$/)) {
		var name = m[1];
		if (defined(r = mt.getMacro(name))) {
			var macro = r;
			return evalMacro(macro, args, false, node, mt, callback);
		}
	} else if (m = command.match(/^\?(\w+)$/)) {
		var name = m[1];
		if (defined(r = mt.getMacro(name))) {
			var macro = r;
			return evalMacro(macro, args, true, node, mt, callback);
		}
	} else if (m = command.match(/^(\w+)$/)) {
		var name = m[1];
		if (defined(r = mt.getMacro(name))) {
			var macro = r;
			return evalMacro(macro, args, false, node, mt, callback);
		} else if (defined(r = getRMacro(mt, name))) {
			var rmacro = r.rmacro;
			var argument = r.argument;
			return evalRMacro(rmacro, argument, name, args, node, mt, callback);
		}
	}
	fireCallback(callback, "NOMACRO", node.src, [command]);
	return new Value(node.src, undefined);
}
function judgeRMacro(rmacro, name) {
	if (defined(rmacro.regexp)) {
		var re = rmacro.regexp;
		var m = re.exec(name);
		if (m) {
			return { rmacro: rmacro, type: "regexp", argument: m };
		}
	} else if (defined(rmacro.names)) {
		var names = rmacro.names;
		var name2 = names.find(function(name2) {
			return name2 === name;
		});
		if (defined(name2)) {
			return { rmacro: rmacro, type: "names", argument: name2 };
		}
	} else if (defined(rmacro.name)) {
		var name2 = rmacro.name;
		if (name2 === name) {
			return { rmacro: rmacro, type: "name", argument: name2 };
		}
	}
}
function getRMacro(mt, name) {
	var rmacros = mt.rmacros;
	var r;
	var rmacro = rmacros.find(function(rmacro) {
		return (r = judgeRMacro(rmacro, name));
	});
	if (defined(rmacro)) {
		return r;
	}
}
function evalRMacro(rmacro, argument, name, args, node, mt, callback) {
	var minArgs = rmacro.num_arg || rmacro.min_arg || Number.NEGATIVE_INFINITY;
	if (args.length < minArgs) {
		fireCallback(callback, "LITTLEARGS", node.src, [name, minArgs, args.length]);
		return new Value(node.src, undefined);
	}
	var maxArgs = rmacro.num_arg || rmacro.max_arg || Number.POSITIVE_INFINITY;
	if (args.length > maxArgs) {
		fireCallback(callback, "EXCESSARGS", node.src, [name, maxArgs, args.length]);
	}
	var func = rmacro.func;
	var mtc = new MTC(mt, node, node.command, args, callback);
	mtc.callerName = name;
	mtc.callerArgument = argument;
	var v = func.apply(mtc, args);
	return new Value(node.src, v);
}
function evalMacro(macro, args, flagNoCall, node, mt, callback, index) {
	index = index || 0;
	var self = null;
	function sub(macro, index) {
	if (macro instanceof Node) {
		if (!flagNoCall) {
			var node2 = macro;
			var args2 = args.slice(index);
			var value = evaluate(node2, mt, callback, function() {
				mt.addMacro("_", args2);
				args2.forEach(function(arg, i) {
					mt.addMacro(i + 1, arg);
				});
			});
			return value;
		}
	} else if (macro instanceof Value) {
	} else if (macro instanceof ValueSequence) {
	} else if (isNull(macro)) {
	} else if (isBoolean(macro)) {
	} else if (isNumber(macro)) {
	} else if (isString(macro)) {
	} else if (isFunction(macro)) {
		if (!flagNoCall) {
			var func = macro;
			var args2 = args.slice(index);
			var objs = args2.map(function(arg) {
				return mt.evaluateAsObject(arg);
			});
			var r = func.apply(self, objs);
			return r;
		}
	} else if (isList(macro)) {
		if (!(index < args.length)) {
			return macro;
		}
		var list = macro;
		var arg = args[index];
		var i = mt.evaluateAsInteger(arg);
		var macro = list[i];
		return sub(macro, index + 1);
	} else if (isDict(macro)) {
		if (!(index < args.length)) {
			return macro;
		}
		var dict = macro;
		var arg = args[index];
		var key = mt.evaluateAsString(arg);
		var macro = dict[key];
		return sub(macro, index + 1);
	} else {
		// js object
		if (!(index < args.length)) {
			return macro;
		}
		var obj = macro;
		var arg = args[index];
		var key = mt.evaluateAsString(arg);
		var macro = obj[key];
		self = obj;
		return sub(macro, index + 1);
	}
	if (index < args.length) {
		fireCallback(callback, "EXCESSARGS", node.src, []);
	}
	var v = macro;
	return v;
	}
	var v = sub(macro, index);
	return new Value(node.src, v);
}

// get
function parseList(str) {
	var strs = str.match(/\S+/g);
	if (strs) return strs;
	return [];
}
function getBoolean(value) {
	function sub(v) {
	if (v instanceof Value) {
		var value = v;
		var v = value.v;
		return sub(v);
	} else if (v instanceof ValueSequence) {
		var vs = v;
		var values = vs.values;
		var r = values.some(function(value) {
			return sub(value);
		});
		return r;
	} else {
		return v ? true : false;
	}
	}
	return sub(value);
}
function getNumber(value) {
	var number;
	function sub(v) {
	if (v instanceof Value) {
		var value = v;
		var v = value.v;
		return sub(v);
	} else if (v instanceof ValueSequence) {
		var vs = v;
		var values = vs.values;
		var r = values.some(function(value) {
			return sub(value);
		});
		return r;
	} else {
		// var n = Number(s);
		var n = Number.parseFloat(v);
		if (!Number.isNaN(n)) {
			number = n;
			return true;
		}
	}
	}
	var r = sub(value);
	if (r) {
		return number;
	}
	return Number.NaN;
}
function getInteger(value) {
	var number = getNumber(value);
	var int = Number.parseInt(number);
	return int;
}
function getString(value) {
	var str = "";
	function sub(v) {
	if (v instanceof Value) {
		var value = v;
		var v = value.v;
		sub(v);
	} else if (v instanceof ValueSequence) {
		var vs = v;
		var values = vs.values;
		values.forEach(function(value) {
			sub(value);
		});
	} else if (v instanceof Node) {
		str += "[node]";
	} else if (isNull(v)) {
	} else if (isBoolean(v)) {
		var b = v;
		str += b ? "true" : "false";
	} else if (isNumber(v)) {
		var n = v;
		str += n.toString(10);
	} else if (isString(v)) {
		var s = v;
		str += s;
	} else if (isFunction(v)) {
		str += "[function]";
	} else if (isList(v)) {
		var l = v;
		str += " ";
		l.forEach(function(item) {
			sub(item);
			str += " ";
		});
	} else if (isDict(v)) {
		var d = v;
		str += " ";
		Object.forEach(d, function(key, value) {
			str += key;
			str += " ";
			sub(value);
			str += " ";
		});
	} else {
		// str += "[object]";
		var o = v;
		str += o.toString();
	}
	}
	sub(value);
	return str;
}
function getList(value) {
	var src = value.src;
	var lists = [];
	var str = "";
	function pushStr() {
		var strs = parseList(str);
		if (strs.length === 0) return;
		var list = strs.map(function(s) {
			var value = new Value(src, s);
			return value;
		});
		lists.push(list);
		str = "";
	}
	function sub(v) {
	if (v instanceof Value) {
		var value = v;
		var v = value.v;
		sub(v);
	} else if (v instanceof ValueSequence) {
		var vs = v;
		var values = vs.values;
		values.forEach(function(value) {
			sub(value);
		});
	} else if (v instanceof Node) {
		str += "[node]";
	} else if (isNull(v)) {
	} else if (isBoolean(v)) {
		var b = v;
		str += b ? "true" : "false";
	} else if (isNumber(v)) {
		var n = v;
		str += n.toString(10);
	} else if (isString(v)) {
		var s = v;
		str += s;
	} else if (isFunction(v)) {
		str += "[function]";
	} else if (isList(v)) {
		pushStr();
		var l = v;
		lists.push(l);
	} else if (isDict(v)) {
		pushStr();
		var d = v;
		var list = [];
		Object.forEach(d, function(key, valueV) {
			var keyV = new Value(src, key);
			list.push(keyV, valueV);
		});
		lists.push(list);
	} else {
		// str += "[object]";
		var o = v;
		str += o.toString();
	}
	}
	sub(value);
	pushStr();
	if (lists.length === 1) {
		return lists[0];
	}
	return Array.concat.apply(null, lists);
}
function getDict(value) {
	var src = value.src;
	var dicts = [];
	var str = "";
	function pushStr() {
		var strs = parseList(str);
		if (strs.length === 0) return;
		var dict = {};
		KvlistForEach(strs, function(key, value) {
			var valueV = new Value(src, value);
			dict[key] = valueV;
		});
		dicts.push(dict);
		str = "";
	}
	function sub(v) {
	if (v instanceof Value) {
		var value = v;
		var v = value.v;
		sub(v);
	} else if (v instanceof ValueSequence) {
		var vs = v;
		var values = vs.values;
		values.forEach(function(value) {
			sub(value);
		});
	} else if (v instanceof Node) {
		str += "[node]";
	} else if (isNull(v)) {
	} else if (isBoolean(v)) {
		var b = v;
		str += b ? "true" : "false";
	} else if (isNumber(v)) {
		var n = v;
		str += n.toString(10);
	} else if (isString(v)) {
		var s = v;
		str += s;
	} else if (isFunction(v)) {
		str += "[function]";
	} else if (isList(v)) {
		pushStr();
		var l = v;
		var dict = {};
		KvlistForEach(l, function(keyV, valueV) {
			var key = getString(keyV);
			dict[key] = valueV;
		});
		dicts.push(dict);
	} else if (isDict(v)) {
		pushStr();
		var d = v;
		dicts.push(d);
	} else {
		// str += "[object]";
		var o = v;
		str += o.toString();
	}
	}
	sub(value);
	pushStr();
	if (dicts.length === 1) {
		return dicts[0];
	}
	return Object.merge.apply(null, dicts);
}
function getFunction(value) {
	var func;
	function sub(v) {
	if (v instanceof Value) {
		var value = v;
		var v = value.v;
		return sub(v);
	} else if (v instanceof ValueSequence) {
		var vs = v;
		var values = vs.values;
		var r = values.some(function(value) {
			return sub(value);
		});
		return r;
	} else if (isFunction(v)) {
		func = v;
		return true;
	}
	}
	var r = sub(value);
	if (r) {
		return func;
	}
	return function() {};
}
function getObject(value) {
	var node;
	var num;
	var func;
	var list;
	var dict;
	var obj;
	function sub(v) {
	if (v instanceof Value) {
		var value = v;
		var v = value.v;
		sub(v);
	} else if (v instanceof ValueSequence) {
		var vs = v;
		var values = vs.values;
		values.forEach(function(value) {
			sub(value);
		});
	} else if (v instanceof Node) {
		// node = v;
	} else if (isNull(v)) {
	} else if (isBoolean(v)) {
	} else if (isNumber(v)) {
		num = v;
	} else if (isString(v)) {
	} else if (isFunction(v)) {
		func = v;
	} else if (isList(v)) {
		list = v;
	} else if (isDict(v)) {
		dict = v;
	} else {
		obj = v;
	}
	}
	sub(value);
	if (defined(obj)) {
		return obj;
	} else if (defined(func)) {
		return func;
	} else if (defined(dict)) {
		var dictV = getDict(value);
		dict = Object.map(dictV, function(valueV) {
			var value = getObject(valueV);
			return value;
		});
		return dict;
	} else if (defined(list)) {
		var listV = getList(value);
		list = listV.map(function(itemV) {
			var item = getObject(itemV);
			return item;
		});
		return list;
	} else if (defined(num)) {
		return num;
	} else {
		var str = getString(value);
		return str;
	}
}
function getStringList(value) {
	var list = getList(value);
	var strs = list.map(function(value) {
		return getString(value);
	});
	return strs;
}

// subroutine
function newMacroArgType(mt, arg, type) {
	// regexp: /^(|option_|o)()(let)(|_boolean|_bool|b|_number|_num|n|_integer|_int|i|_string|_str|s|_function|_func|f|_list|l|_dict|d|_object|_obj|o|_value|v|_expr|e)$/,
	if (type === "_boolean" || type === "_bool" || type === "b") {
		return mt.evaluateAsBoolean(arg);
	} else if (type === "_number" || type === "_num" || type === "n") {
		return mt.evaluateAsNumber(arg);
	} else if (type === "_integer" || type === "_int" || type === "i") {
		return mt.evaluateAsInteger(arg);
	} else if (type === "_string" || type === "_str" || type === "s") {
		return mt.evaluateAsString(arg);
	} else if (type === "_function" || type === "_func" || type === "f") {
		return mt.evaluateAsFunction(arg);
	} else if (type === "_list" || type === "l") {
		return mt.evaluateAsList(arg);
	} else if (type === "_dict" || type === "d") {
		return mt.evaluateAsDict(arg);
	} else if (type === "_object" || type === "_obj" || type === "o") {
		return mt.evaluateAsObject(arg);
	} else if (type === "_value" || type === "v") {
		return mt.evaluate(arg);
	} else if (type === "_expr" || type === "e") {
		return arg;
	}
	return mt.evaluate(arg);
	// return arg;
}
function callMacro(mtc, args, flagNoCall) {
	var nameA = args.shift();
	var name = mtc.evaluateAsString(nameA);
	var r;
	if (defined(r = mtc.getMacro(name))) {
		var macro = r;
		return evalMacro(macro, args, flagNoCall, mtc.node, mtc.mt, mtc.cbfunc);
	}
}

var MacroText;
MacroText = function(rmacros, macros, cbfunc) {
	this.rmacros = rmacros;
	this.cbfunc = cbfunc;
	this.macros = macros;
};
MacroText.getMessageType = function(code) {
	return messageTypes[code] || "Unknown Error";
};
MacroText.create = function(options) {
	options = options || {};
	var rmacros = [];
	var macros = {};
	var callback = options.callback || function() {};
	var mt = new MacroText(rmacros, macros, callback);
	mt.import("std");
	if (options.allowSystem) {
		mt.import("system");
	}
	return mt;
};

MacroText.prototype.getMessageType = MacroText.getMessageType;
MacroText.prototype.parse = function(text, tag, callback) {
	callback = callback || this.cbfunc;
	return parse(text, callback, tag);
};
MacroText.prototype.printNode = function(node) {
	return printNode(node);
};
MacroText.prototype.printValue = function(v) {
	return printValue(v);
};
MacroText.prototype.evaluate = function(node, hook, callback) {
	callback = callback || this.cbfunc;
	return evaluate(node, this, callback, hook);
};
MacroText.prototype.evaluateAsBoolean = function(node, hook, callback) {
	return getBoolean(this.evaluate.apply(this, arguments));
};
MacroText.prototype.evaluateAsNumber = function(node, hook, callback) {
	return getNumber(this.evaluate.apply(this, arguments));
};
MacroText.prototype.evaluateAsInteger = function(node, hook, callback) {
	return getInteger(this.evaluate.apply(this, arguments));
};
MacroText.prototype.evaluateAsString = function(node, hook, callback) {
	return getString(this.evaluate.apply(this, arguments));
};
MacroText.prototype.evaluateAsFunction = function(node, hook, callback) {
	return getFunction(this.evaluate.apply(this, arguments));
};
MacroText.prototype.evaluateAsList = function(node, hook, callback) {
	return getList(this.evaluate.apply(this, arguments));
};
MacroText.prototype.evaluateAsDict = function(node, hook, callback) {
	return getDict(this.evaluate.apply(this, arguments));
};
MacroText.prototype.evaluateAsObject = function(node, hook, callback) {
	return getObject(this.evaluate.apply(this, arguments));
};
MacroText.prototype.evaluateAsStringList = function(node, hook, callback) {
	return getStringList(this.evaluate.apply(this, arguments));
};
MacroText.prototype.getBoolean = getBoolean;
MacroText.prototype.getNumber = getNumber;
MacroText.prototype.getInteger = getInteger;
MacroText.prototype.getString = getString;
MacroText.prototype.getFunction = getFunction;
MacroText.prototype.getList = getList;
MacroText.prototype.getDict = getDict;
MacroText.prototype.getObject = getObject;
MacroText.prototype.getStringList = getStringList;
MacroText.prototype.process = function(text, tag, callback) {
	callback = callback || this.cbfunc;
	return evaluate(parse(text, callback, tag), this, callback);
};
MacroText.prototype.processAsBoolean = function(text, tag, callback) {
	return getBoolean(this.process.apply(this, arguments));
};
MacroText.prototype.processAsNumber = function(text, tag, callback) {
	return getNumber(this.process.apply(this, arguments));
};
MacroText.prototype.processAsInteger = function(text, tag, callback) {
	return getInteger(this.process.apply(this, arguments));
};
MacroText.prototype.processAsString = function(text, tag, callback) {
	return getString(this.process.apply(this, arguments));
};
MacroText.prototype.processAsFunction = function(text, tag, callback) {
	return getFunction(this.process.apply(this, arguments));
};
MacroText.prototype.processAsList = function(text, tag, callback) {
	return getList(this.process.apply(this, arguments));
};
MacroText.prototype.processAsDict = function(text, tag, callback) {
	return getDict(this.process.apply(this, arguments));
};
MacroText.prototype.processAsObject = function(text, tag, callback) {
	return getObject(this.process.apply(this, arguments));
};
MacroText.prototype.processAsStringList = function(text, tag, callback) {
	return getStringList(this.process.apply(this, arguments));
};
MacroText.prototype.addRMacro = function(rmacro) {
	var rmacros = this.rmacros;
	Array.prototype.push.apply(rmacros, arguments);
};
MacroText.prototype.import = function(name) {
	var rmacros = this.rmacros;
	var rmacros2 = (
		name === "std" ? rmacros_std :
		name === "system" ? rmacros_system :
		[]
	);
	Array.prototype.push.apply(rmacros, rmacros2);
};
MacroText.prototype.getMacro = function(name) {
	var macros = this.macros;
	var ref = macros[name];
	if (!defined(ref)) return;
	var macro = ref[0];
	return macro;
};
MacroText.prototype.addMacro = function(name, macro, replace) {
	var macros = this.macros;
	if (replace) {
		var ref = macros[name];
		if (defined(ref)) {
			ref[0] = macro;
			return;
		}
	}
	macros[name] = [macro];
};
MacroText.prototype.saveMacros = function() {
	var macros = this.macros;
	var macros2 = Object.clone(macros);
	return macros2;
	// this.macros = macros2;
	// return macros;
};
MacroText.prototype.restoreMacros = function(macros) {
	this.macros = macros;
};

var MTC = function(mt, node, command, args, cbfunc) {
	this.mt = mt;
	this.node = node;
	this.src = node.src;
	this.command = command;
	this.args = args;
	this.cbfunc = cbfunc;
};
MTC.prototype = Object.create(MacroText.prototype);
MTC.prototype.callback = function(code, args) {
	var callback = this.cbfunc;
	var src = this.src;
	fireCallback(callback, code, src, args);
};
MTC.prototype.evaluate = function(node, hook, callback) {
	return MacroText.prototype.evaluate.apply(this.mt, arguments);
};
MTC.prototype.getMacro = function(name) {
	return MacroText.prototype.getMacro.apply(this.mt, arguments);
};
MTC.prototype.addMacro = function(name, macro, replace) {
	return MacroText.prototype.addMacro.apply(this.mt, arguments);
};

// rmacros
var rmacros_std = [
// ignore
	{
		name: "ignore",
		func: function() {
		}
	},
// void
	{
		name: "void",
		func: function(arg) {
			Array.from(arguments).forEach(function(arg) {
				this.evaluate(arg);
			}, this);
		}
	},
// echo
	{
		name: "echo",
		func: function(arg) {
			var values = Array.from(arguments).map(function(arg) {
				return this.evaluate(arg);
			}, this);
			var value = new ValueSequence(this.src, values);
			return value;
		}
	},
// id
	{
		name: "id",
		num_arg: 1,
		func: function(arg) {
			var value = this.evaluate(arg);
			return value;
		}
	},
// say
	{
		name: "say",
		sideeffect: true,
		func: function(msgA) {
			var msgs = Array.from(arguments).map(function(arg) {
				var msg = this.evaluateAsString(arg);
				return msg;
			}, this);
			this.callback("MESSAGE", msgs);
		}
	},

// let
	{
		// regexp: /^(|option_|o)()(let)(_string|s|_list|l|_dict|d|_node|n||_func|f|_hfunc|h|_macro|m|_rmacro|r|_bind|b)$/,
		regexp: /^(|option_|o)()(let)(|_boolean|_bool|b|_number|_num|n|_integer|_int|i|_string|_str|s|_function|_func|f|_list|l|_dict|d|_object|_obj|o|_value|v|_expr|e)$/,
		num_arg: 3,
		func: function(nameA, macroA, exprA) {
			var m = this.callerArgument;
			var constant = m[1], tuple = m[2], command = m[3], type = m[4];
			var name = this.evaluateAsString(nameA);
			var macro = newMacroArgType(this, macroA, type);
			if (!defined(macro)) {
				return;
			}
			var value = this.evaluate(exprA, function(mt) {
				mt.addMacro(name, macro);
			});
			return value;
		}
	},
// tlet
	{
		regexp: /^(|option_|o)(tuple_|t)(let)()$/,
		num_arg: 3,
		func: function(nameA, macroA, exprA) {
			var m = this.callerArgument;
			var constant = m[1], tuple = m[2], command = m[3], type = m[4];
			var names = this.evaluateAsStringList(nameA);
			var values = this.evaluateAsList(macroA);
			if (names.length > values.length) {
				// this.callback("LITTLEVALUE", [names.length, values.length]);
			}
			var value = this.evaluate(exprA, function(mt) {
				names.forEach(function(name, i) {
					var value = values[i];
					// value = undefined unless(defined(value))
					mt.addMacro(name, value);
				});
			});
			return value;
		}
	},
// set,put
	{
		sideeffect: true,
		regexp: /^(|option_|o)()(set|put)(|_boolean|_bool|b|_number|_num|n|_integer|_int|i|_string|_str|s|_function|_func|f|_list|l|_dict|d|_object|_obj|o|_value|v|_expr|e)$/,
		num_arg: 2,
		func: function(nameA, macroA) {
			var m = this.callerArgument;
			var constant = m[1], tuple = m[2], command = m[3], type = m[4];
			var name = this.evaluateAsString(nameA);
			var macro = newMacroArgType(this, macroA, type);
			if (!defined(macro)) {
				return;
			}
			if (command === "put") {
				this.addMacro(name, macro, true);
			} else {
				this.addMacro(name, macro);
			}
		}
	},
// tset,tput
	{
		sideeffect: true,
		regexp: /^(|option_|o)(tuple_|t)(set|put)()$/,
		num_arg: 2,
		func: function(nameA, macroA) {
			var m = this.callerArgument;
			var constant = m[1], tuple = m[2], command = m[3], type = m[4];
			var names = this.evaluateAsStringList(nameA);
			var values = this.evaluateAsList(macroA);
			if (names.length > values.length) {
				// this.callback("LITTLEVALUE", [names.length, values.length]);
			}
			names.forEach(function(name, i) {
				var value = values[i];
				// value = undefined unless(defined(value))
				if (command === "put") {
					this.addMacro(name, value, true);
				} else {
					this.addMacro(name, value);
				}
			}, this);
		}
	},

// get
	{
		name: "get",
		num_arg: 1,
		func: function(nameA) {
			var name = this.evaluateAsString(nameA);
			var macro = this.getMacro(name);
			if (!defined(macro)) {
				return;
			}
			return macro;
		}
	},
// def
	{
		name: "def",
		num_arg: 1,
		func: function(nameA) {
			var name = this.evaluateAsString(nameA);
			var macro = this.getMacro(name);
			return defined(macro);
		}
	},
// call
	{
		name: "call",
		min_arg: 1,
		sideeffect: true,
		func: function(nameA) {
			var args = Array.from(arguments);
			return callMacro(this, args, false);
		}
	},
// pick
	{
		name: "pick",
		min_arg: 1,
		func: function(nameA) {
			var args = Array.from(arguments);
			return callMacro(this, args, true);
		}
	},

{ name: "if",
	min_arg: 2,
	max_arg: 3,
	func: function(conditionA, exprTA, exprFA) {
		var condition = this.evaluateAsBoolean(conditionA);
		if (condition) {
			return this.evaluate(exprTA);
		} else {
			if (!defined(exprFA)) return;
			return this.evaluate(exprFA);
		}
	}
	},
{ name: "ifg",
	func: function() {
		for (var i = 0; i < arguments.length; i += 2) {
			if (i + 1 === arguments.length) {
				var arg = arguments[i];
				return this.evaluate(arg);
			}
			var conditionA = arguments[i];
			var condition = this.evaluateAsBoolean(conditionA);
			if (condition) {
				var arg = arguments[i + 1];
				return this.evaluate(arg);
			}
		}
	}
	},

{ name: "switch",
	min_arg: 1,
	func: function(valueA) {
		var value = this.evaluateAsObject(valueA);
		for (var i = 1; i < arguments.length; i += 2) {
			if (i + 1 === arguments.length) {
				var arg = arguments[i];
				return this.evaluate(arg);
			}
			var value2A = arguments[i];
			var value2 = this.evaluateAsObject(value2A);
			if (value2 == value) {
				var arg = arguments[i + 1];
				return this.evaluate(arg);
			}
		}
	}
	},
{ name: "loop",
	num_arg: 2,
	func: function(countA, arg) {
		var count = this.evaluateAsInteger(countA);
		for (var i = 0; i < count; i++) {
			this.evaluate(arg);
		}
	}
	},
{ name: "while",
	min_arg: 2,
	max_arg: 3,
	func: function(conditionA, arg, countA) {
		if (defined(countA)) {
			var count = this.evaluateAsInteger(countA);
			for (var i = 0; i < count; i++) {
				if (!this.evaluateAsBoolean(conditionA)) {
					break;
				}
				this.evaluate(arg);
			}
		} else {
			while (this.evaluateAsBoolean(conditionA)) {
				this.evaluate(arg);
			}
		}
	}
	},

{ name: "true",
	num_arg: 0,
	func: function() {
		return true;
	}
	},
{ name: "false",
	num_arg: 0,
	func: function() {
		return false;
	}
	},
{ name: "not",
	num_arg: 1,
	func: function(arg) {
		var value = this.evaluateAsBoolean(arg);
		var r = !value;
		return r;
	}
	},
{ name: "or",
	min_arg: 1,
	func: function(arg) {
		var r = Array.from(arguments).some(function(arg) {
			return this.evaluateAsBoolean(arg);
		}, this);
		return r;
	}
	},
{ name: "and",
	min_arg: 1,
	func: function(arg) {
		var r = Array.from(arguments).every(function(arg) {
			return this.evaluateAsBoolean(arg);
		}, this);
		return r;
	}
	},

{ name: "int",
	num_arg: 1,
	func: function(arg) {
		var r = this.evaluateAsInteger(arg);
		return r;
	}
	},
{ name: "bnot",
	names: ["bnot", "bit_not"],
	num_arg: 1,
	func: function(arg) {
		var value = this.evaluateAsInteger(arg);
		var r = ~value;
		return r;
	}
	},
{ name: "bor",
	names: ["bor", "bit_or"],
	min_arg: 1,
	func: function(arg) {
		var values = Array.from(arguments).map(function(arg) {
			return this.evaluateAsInteger(arg);
		}, this);
		var r = values.reduce(function(a, b) {
			return a | b;
		});
		return r;
	}
	},
{ name: "band",
	names: ["band", "bit_and"],
	min_arg: 1,
	func: function(arg) {
		var values = Array.from(arguments).map(function(arg) {
			return this.evaluateAsInteger(arg);
		}, this);
		var r = values.reduce(function(a, b) {
			return a & b;
		});
		return r;
	}
	},
{ name: "bxor",
	names: ["bxor", "bit_xor"],
	min_arg: 1,
	func: function(arg) {
		var values = Array.from(arguments).map(function(arg) {
			return this.evaluateAsInteger(arg);
		}, this);
		var r = values.reduce(function(a, b) {
			return a ^ b;
		});
		return r;
	}
	},
{ name: "lshift",
	min_arg: 1,
	func: function(arg) {
		var values = Array.from(arguments).map(function(arg) {
			return this.evaluateAsInteger(arg);
		}, this);
		var r = values.reduce(function(a, b) {
			return a << b;
		});
		return r;
	}
	},
{ name: "rshift",
	min_arg: 1,
	func: function(arg) {
		var values = Array.from(arguments).map(function(arg) {
			return this.evaluateAsInteger(arg);
		}, this);
		var r = values.reduce(function(a, b) {
			return a >>> b;
		});
		return r;
	}
	},

{ name: "num",
	names: ["num", "number"],
	num_arg: 1,
	func: function(arg) {
		var r = this.evaluateAsNumber(arg);
		return r;
	}
	},
{ name: "add",
	min_arg: 1,
	func: function(arg) {
		var values = Array.from(arguments).map(function(arg) {
			return this.evaluateAsNumber(arg);
		}, this);
		var r = values.reduce(function(a, b) {
			return a + b;
		});
		return r;
	}
	},
{ name: "sub",
	min_arg: 1,
	func: function(arg) {
		var values = Array.from(arguments).map(function(arg) {
			return this.evaluateAsNumber(arg);
		}, this);
		var r = values.reduce(function(a, b) {
			return a - b;
		});
		return r;
	}
	},
{ name: "mul",
	min_arg: 1,
	func: function(arg) {
		var values = Array.from(arguments).map(function(arg) {
			return this.evaluateAsNumber(arg);
		}, this);
		var r = values.reduce(function(a, b) {
			return a * b;
		});
		return r;
	}
	},
{ name: "div",
	min_arg: 1,
	func: function(arg) {
		var values = Array.from(arguments).map(function(arg) {
			return this.evaluateAsNumber(arg);
		}, this);
		var r = values.reduce(function(a, b) {
			return a / b;
		});
		return r;
	}
	},
{ name: "mod",
	min_arg: 1,
	func: function(arg) {
		var values = Array.from(arguments).map(function(arg) {
			return this.evaluateAsNumber(arg);
		}, this);
		var r = values.reduce(function(a, b) {
			return a % b;
		});
		return r;
	}
	},
{ name: "pow",
	min_arg: 1,
	func: function(arg) {
		var values = Array.from(arguments).map(function(arg) {
			return this.evaluateAsNumber(arg);
		}, this);
		var r = values.reduce(function(a, b) {
			return Math.pow(a, b);
		});
		return r;
	}
	},
{ name: "max",
	min_arg: 1,
	func: function(arg) {
		var values = Array.from(arguments).map(function(arg) {
			return this.evaluateAsNumber(arg);
		}, this);
		var r = Math.max.apply(null, values);
		return r;
	}
	},
{ name: "min",
	min_arg: 1,
	func: function(arg) {
		var values = Array.from(arguments).map(function(arg) {
			return this.evaluateAsNumber(arg);
		}, this);
		var r = Math.min.apply(null, values);
		return r;
	}
	},

{ name: "eq",
	min_arg: 2,
	func: function(arg) {
		var values = Array.from(arguments).map(function(arg) {
			return this.evaluateAsNumber(arg);
		}, this);
		var r = values.allnext(function(a, b) {
			return a == b;
		});
		return r;
	}
	},
{ name: "ne",
	min_arg: 2,
	func: function(arg) {
		var values = Array.from(arguments).map(function(arg) {
			return this.evaluateAsNumber(arg);
		}, this);
		var r = values.alltwo(function(a, b) {
			return a != b;
		});
		return r;
	}
	},
{ name: "lt",
	min_arg: 2,
	func: function(arg) {
		var values = Array.from(arguments).map(function(arg) {
			return this.evaluateAsNumber(arg);
		}, this);
		var r = values.allnext(function(a, b) {
			return a < b;
		});
		return r;
	}
	},
{ name: "gt",
	min_arg: 2,
	func: function(arg) {
		var values = Array.from(arguments).map(function(arg) {
			return this.evaluateAsNumber(arg);
		}, this);
		var r = values.allnext(function(a, b) {
			return a > b;
		});
		return r;
	}
	},
{ name: "le",
	min_arg: 2,
	func: function(arg) {
		var values = Array.from(arguments).map(function(arg) {
			return this.evaluateAsNumber(arg);
		}, this);
		var r = values.allnext(function(a, b) {
			return a <= b;
		});
		return r;
	}
	},
{ name: "ge",
	min_arg: 2,
	func: function(arg) {
		var values = Array.from(arguments).map(function(arg) {
			return this.evaluateAsNumber(arg);
		}, this);
		var r = values.allnext(function(a, b) {
			return a >= b;
		});
		return r;
	}
	},
{ name: "cmp",
	num_arg: 2,
	func: function(aA, bA) {
		var a = this.evaluateAsNumber(aA);
		var b = this.evaluateAsNumber(bA);
		var r = a < b ? -1 : a > b ? 1 : 0;
		return r;
	}
	},

{ name: "str",
	names: ["string", "str"],
	func: function(arg) {
		var strs = Array.from(arguments).map(function(arg) {
			return this.evaluateAsString(arg);
		}, this);
		var r = strs.join("");
		return r;
	}
	},
{ name: "srepeat",
	names: ["srepeat", "str_repeat"],
	num_arg: 2,
	func: function(strA, countA) {
		var str = this.evaluateAsString(strA);
		var count = this.evaluateAsInteger(countA);
		var r = "";
		for (var i = 0; i < count; i++) {
			r += str;
		}
		return r;
	}
	},
{ name: "slen",
	names: ["slen", "str_len"],
	num_arg: 1,
	func: function(strA) {
		var str = this.evaluateAsString(strA);
		var r = str.length;
		return r;
	}
	},
{ name: "substr",
	min_arg: 2,
	max_arg: 3,
	func: function(strA, indexA, lengthA) {
		var str = this.evaluateAsString(strA);
		var index = this.evaluateAsInteger(indexA);
		var length = defined(lengthA) ? this.evaluateAsInteger(lengthA) : undefined;
		var r = str.substr(index, length);
		return r;
	}
	},
{ name: "index",
	min_arg: 2,
	max_arg: 3,
	func: function(strA, substrA, positionA) {
		var str = this.evaluateAsString(strA);
		var substr = this.evaluateAsString(substrA);
		var position = this.evaluateAsInteger(positionA);
		var position = defined(positionA) ? this.evaluateAsInteger(positionA) : undefined;
		var r = str.indexOf(substr, position);
		return r;
	}
	},
{ name: "rindex",
	min_arg: 2,
	max_arg: 3,
	func: function(strA, substrA, positionA) {
		var str = this.evaluateAsString(strA);
		var substr = this.evaluateAsString(substrA);
		var position = this.evaluateAsInteger(positionA);
		var position = defined(positionA) ? this.evaluateAsInteger(positionA) : undefined;
		var r = str.lastIndexOf(substr, position);
		return r;
	}
	},

{ name: "seq",
	names: ["seq", "str_eq"],
	min_arg: 2,
	func: function(arg) {
		var values = Array.from(arguments).map(function(arg) {
			return this.evaluateAsString(arg);
		}, this);
		var r = values.allnext(function(a, b) {
			return a == b;
		});
		return r;
	}
	},
{ name: "sne",
	names: ["sne", "str_ne"],
	min_arg: 2,
	func: function(arg) {
		var values = Array.from(arguments).map(function(arg) {
			return this.evaluateAsString(arg);
		}, this);
		var r = values.alltwo(function(a, b) {
			return a != b;
		});
		return r;
	}
	},
{ name: "slt",
	names: ["slt", "str_lt"],
	min_arg: 2,
	func: function(arg) {
		var values = Array.from(arguments).map(function(arg) {
			return this.evaluateAsString(arg);
		}, this);
		var r = values.allnext(function(a, b) {
			return a < b;
		});
		return r;
	}
	},
{ name: "sgt",
	names: ["sgt", "str_gt"],
	min_arg: 2,
	func: function(arg) {
		var values = Array.from(arguments).map(function(arg) {
			return this.evaluateAsString(arg);
		}, this);
		var r = values.allnext(function(a, b) {
			return a > b;
		});
		return r;
	}
	},
{ name: "sle",
	names: ["sle", "str_le"],
	min_arg: 2,
	func: function(arg) {
		var values = Array.from(arguments).map(function(arg) {
			return this.evaluateAsString(arg);
		}, this);
		var r = values.allnext(function(a, b) {
			return a <= b;
		});
		return r;
	}
	},
{ name: "sge",
	names: ["sge", "str_ge"],
	min_arg: 2,
	func: function(arg) {
		var values = Array.from(arguments).map(function(arg) {
			return this.evaluateAsString(arg);
		}, this);
		var r = values.allnext(function(a, b) {
			return a >= b;
		});
		return r;
	}
	},
{ name: "scmp",
	names: ["scmp", "str_cmp"],
	num_arg: 2,
	func: function(aA, bA) {
		var a = this.evaluateAsString(aA);
		var b = this.evaluateAsString(bA);
		var r = a < b ? -1 : a > b ? 1 : 0;
		return r;
	}
	},

// split
	{
		name: "split",
		num_arg: 2,
		func: function(separatorA, strA) {
			var separator = this.evaluateAsString(separatorA);
			var str = this.evaluateAsString(strA);
			var r = str.split(separator, -1);
			return r;
		}
	},
// join
	{
		name: "join",
		num_arg: 2,
		func: function(separatorA, strsA) {
			var separator = this.evaluateAsString(separatorA);
			var strs = this.evaluateAsStringList(strsA);
			var r = strs.join(separator);
			return r;
		}
	},

// list
	{
		name: "list",
		names: ["list", "kvlist"],
		func: function(arg) {
			var values = Array.from(arguments).map(function(arg) {
				return this.evaluate(arg);
			}, this);
			return values;
		}
	},
// lparse
	{
		name: "lparse",
		names: ["lparse", "list_parse"],
		func: function(arg) {
			var lists = Array.from(arguments).map(function(arg) {
				return this.evaluateAsList(arg);
			}, this);
			var values = Array.concat.apply(null, lists);
			return values;
		}
	},
// lappend
	{
		name: "lappend",
		names: ["lappend", "list_append"],
		min_arg: 1,
		func: function(listA) {
			var args = Array.from(arguments).slice(1);
			var list = this.evaluateAsList(listA);
			var values = args.map(function(arg) {
				return this.evaluate(arg);
			}, this);
			Array.prototype.push.apply(list, values);
			return list;
		}
	},
// repeat
	{
		name: "repeat",
		num_arg: 2,
		func: function(arg, countA) {
			var value = this.evaluate(arg);
			var count = this.evaluateAsInteger(countA);
			var r = [];
			for (var i = 0; i < count; i++) {
				r.push(value);
			}
			return r;
		}
	},
// lrepeat
	{
		name: "lrepeat",
		names: ["lrepeat", "list_repeat"],
		num_arg: 2,
		func: function(arg, countA) {
			var list = this.evaluateAsList(arg);
			var count = this.evaluateAsInteger(countA);
			var r = [];
			for (var i = 0; i < count; i++) {
				Array.prototype.push.apply(r, list);
			}
			return r;
		}
	},
{ name: "range",
	num_arg: 2,
	func: function(startA, endA) {
		var start = this.evaluateAsInteger(startA);
		var end = this.evaluateAsInteger(endA);
		var list = [];
		for (var i = start; i <= end; i++) {
			list.push(i);
		}
		var r = list;
		return r;
	}
	},
{ name: "at",
	num_arg: 2,
	func: function(arg, indexA) {
		var list = this.evaluateAsList(arg);
		var index = this.evaluateAsInteger(indexA);
		var r = list[index];
		return r;
	}
	},
{ name: "len",
	num_arg: 1,
	func: function(arg) {
		var list = this.evaluateAsString(arg);
		var r = list.length;
		return r;
	}
	},
{ name: "slice",
	min_arg: 2,
	max_arg: 3,
	func: function(arg, indexA, lengthA) {
		var list = this.evaluateAsList(arg);
		var index = this.evaluateAsInteger(indexA);
		var length = defined(lengthA) ? this.evaluateAsInteger(lengthA) : undefined;
		list = [].concat(list);
		var r = defined(length) ? list.splice(index, length) : list.splice(index);
		return r;
	}
	},
{ name: "splice",
	min_arg: 2,
	func: function(arg, indexA, lengthA) {
		var args = Array.from(arguments).slice(3);
		var list = this.evaluateAsList(arg);
		var index = this.evaluateAsInteger(indexA);
		var length = defined(lengthA) ? this.evaluateAsInteger(lengthA) : undefined;
		var list2 = args.map(function(arg) {
			return this.evaluate(arg);
		}, this);
		list = [].concat(list);
		var args2 = defined(length) ? [index, length].concat(list2) : [index];
		var r = Array.prototype.splice.apply(list, args2);
		return list;
	}
	},
{ name: "reverse",
	num_arg: 1,
	func: function(arg) {
		var list = this.evaluateAsList(arg);
		var r = list.reverse();
		return r;
	}
	},
// sort

// for
	{
		name: "for",
		names: ["for", "foreach"],
		num_arg: 3,
		func: function(nameA, listA, arg) {
			var name = this.evaluateAsString(nameA);
			var list = this.evaluateAsList(listA);
			list.forEach(function(value) {
				this.evaluate(arg, function(mt) {
					mt.addMacro(name, value);
				});
			}, this);
		}
	},
// lfor
	{
		name: "lfor",
		names: ["lfor", "list_for", "lforeach", "list_foreach"],
		num_arg: 2,
		func: function(arg, listA) {
			var list = this.evaluateAsList(listA);
			list.forEach(function(value) {
				this.evaluate(arg, function(mt) {
					mt.addMacro("_", value);
				});
			}, this);
		}
	},
// map
	{
		name: "map",
		names: ["map", "lmap", "list_map"],
		num_arg: 2,
		func: function(arg, listA) {
			var list = this.evaluateAsList(listA);
			var r = list.map(function(value) {
				return this.evaluate(arg, function(mt) {
					mt.addMacro("_", value);
				});
			}, this);
			return r;
		}
	},
{ name: "filter",
	names: ["filter", "lfilter", "list_filter"],
	num_arg: 2,
	func: function(arg, listA) {
		var list = this.evaluateAsList(listA);
		var r = list.filter(function(value) {
			return this.evaluateAsBoolean(arg, function(mt) {
				mt.addMacro("_", value);
			});
		}, this);
		return r;
	}
	},
{ name: "find",
	num_arg: 2,
	func: function(arg, listA) {
		var list = this.evaluateAsList(listA);
		var r = list.find(function(value) {
			return this.evaluateAsBoolean(arg, function(mt) {
				mt.addMacro("_", value);
			});
		}, this);
		return r;
	}
	},
{ name: "all",
	num_arg: 2,
	func: function(arg, listA) {
		var list = this.evaluateAsList(listA);
		var r = list.every(function(value) {
			return this.evaluateAsBoolean(arg, function(mt) {
				mt.addMacro("_", value);
			});
		}, this);
		return r;
	}
	},
{ name: "some",
	num_arg: 2,
	func: function(arg, listA) {
		var list = this.evaluateAsList(listA);
		var r = list.some(function(value) {
			return this.evaluateAsBoolean(arg, function(mt) {
				mt.addMacro("_", value);
			});
		}, this);
		return r;
	}
	},
{ name: "fold",
	num_arg: 2,
	func: function(arg, listA) {
		var list = this.evaluateAsList(listA);
		var r = list.reduce(function(a, b) {
			return this.evaluate(arg, function(mt) {
				mt.addMacro("a", a);
				mt.addMacro("b", b);
			});
		}, this);
		return r;
	}
	},

// value
	{
		name: "value",
		num_arg: 2,
		func: function(dictA, keyA) {
			var dict = this.evaluateAsDict(dictA);
			var key = this.evaluateAsString(keyA);
			var value = dict[key];
			return value;
		}
	},
// keys
	{
		name: "keys",
		num_arg: 1,
		func: function(kvlistA) {
			var kvlist = this.evaluateAsList(kvlistA);
			var keys = [];
			KvlistForEach(kvlist, function(key, value) {
				keys.push(key);
			});
			return keys;
		}
	},
// values
	{
		name: "values",
		num_arg: 1,
		func: function(kvlistA) {
			var kvlist = this.evaluateAsList(kvlistA);
			var values = [];
			KvlistForEach(kvlist, function(key, value) {
				values.push(value);
			});
			return keys;
		}
	},
// kvfor
	{
		name: "kvfor",
		names: ["kvfor", "kvlist_for", "kvforeach", "kvlist_foreach", "dfor", "dict_for", "dforeach", "dict_foreach"],
		num_arg: 2,
		func: function(arg, kvlistA) {
			var kvlist = this.evaluateAsList(kvlistA);
			KvlistForEach(kvlist, function(key, value) {
				this.evaluate(arg, function(mt) {
					mt.addMacro("a", key);
					mt.addMacro("b", value);
				});
			}, this);
		}
	},
// kvmap
	{
		name: "kvmap",
		names: ["kvmap", "kvlist_map", "dmap", "dict_map"],
		num_arg: 2,
		func: function(arg, kvlistA) {
			var kvlist = this.evaluateAsList(kvlistA);
			var list = [];
			KvlistForEach(kvlist, function(key, value) {
				var value2 = this.evaluate(arg, function(mt) {
					mt.addMacro("a", key);
					mt.addMacro("b", value);
				});
				list.push(value2);
			}, this);
			var r = list;
			return r;
		}
	},
// kmap
	{
		name: "kmap",
		names: ["kmap", "kvlist_kmap", "kvlist_key_map", "dkmap", "dict_kmap", "dict_key_map"],
		num_arg: 2,
		func: function(arg, kvlistA) {
			var kvlist = this.evaluateAsList(kvlistA);
			var kvlist2 = [];
			KvlistForEach(kvlist, function(key, value) {
				var key2 = this.evaluate(arg, function(mt) {
					mt.addMacro("_", key);
				});
				kvlist2.push(key2, value);
			}, this);
			var r = kvlist2;
			return r;
		}
	},
// vmap
	{
		name: "vmap",
		names: ["vmap", "kvlist_vmap", "kvlist_value_map", "dvmap", "dict_vmap", "dict_value_map"],
		num_arg: 2,
		func: function(arg, kvlistA) {
			var kvlist = this.evaluateAsList(kvlistA);
			var kvlist2 = [];
			KvlistForEach(kvlist, function(key, value) {
				var value2 = this.evaluate(arg, function(mt) {
					mt.addMacro("_", value);
				});
				kvlist2.push(key, value2);
			}, this);
			var r = kvlist2;
			return r;
		}
	},

// dict
	{
		name: "dict",
		func: function(keyA, valueA) {
			var values = Array.from(arguments).map(function(arg) {
				return this.evaluate(arg);
			}, this);
			var dict = {};
			KvlistForEach(values, function(keyV, valueV) {
				var key = getString(keyV);
				dict[key] = valueV;
			});
			return dict;
		}
	},
// dparse
	{
		name: "dparse",
		names: ["dparse", "dict_parse"],
		func: function(arg) {
			var dicts = Array.from(arguments).map(function(arg) {
				return this.evaluateAsDict(arg);
			}, this);
			var dict = Object.merge.apply(null, dicts);
			return dict;
		}
	},
// dappend
	{
		name: "dappend",
		names: ["dappend", "dict_append"],
		min_arg: 1,
		func: function(dictA) {
			var args = Array.from(arguments).slice(1);
			var dict = this.evaluateAsDict(dictA);
			var values = args.map(function(arg) {
				return this.evaluate(arg);
			}, this);
			KvlistForEach(values, function(keyV, valueV) {
				var key = getString(keyV);
				dict[key] = valueV;
			});
			return dict;
		}
	},
// dsort
	{
		name: "dsort",
		names: ["dsort", "dict_sort"],
		num_arg: 1,
		func: function(dictA) {
			var dict = this.evaluateAsDict(dictA);
			var keys = Object.keys(dict).sort();
			var kvlist = [];
			keys.forEach(function(key) {
				var value = dict[key];
				kvlist.push(key, value);
			});
			return kvlist;
		}
	},

{ name: "func",
	max_arg: 1,
	func: function(arg) {
		if (!defined(arg)) {
			return function() {};
		}
		var r = this.evaluateAsFunction(arg);
		return r;
	}
	},
{ name: "fcall",
	min_arg: 1,
	sideeffect: true,
	func: function(funcA) {
		var args = Array.from(arguments).slice(1);
		var func = this.evaluateAsFunction(funcA);
		var objs = args.map(function(arg) {
			return this.evaluateAsObject(arg);
		}, this);
		var r = func.apply(null, objs);
		return r;
	}
	},
// new
	{
		name: "new",
		min_arg: 1,
		func: function(funcA) {
			var args = Array.from(arguments).slice(1);
			var func = this.evaluateAsFunction(funcA);
			var objs = args.map(function(arg) {
				return this.evaluateAsObject(arg);
			}, this);
			var r = Reflect.construct(func, objs);
			return r;
		}
	},
{ name: "obj",
	max_arg: 1,
	func: function(arg) {
		if (!defined(arg)) {
			return undefined;
		}
		var r = this.evaluateAsObject(arg);
		return r;
	}
	},

// input
	{
		name: "input",
		num_arg: 1,
		func: function(textA) {
			var text = this.evaluateAsString(textA);
			var node = this.mt.parse(text, this.src.tag);
			return this.evaluate(node);
		}
	},
// tostr
	{
		name: "tostr",
		num_arg: 1,
		func: function(arg) {
			var str = this.evaluate(arg).toString();
			return str;
		}
	},
];
var rmacros_system = [
// import
	{
		name: "import",
		min_arg: 1,
		max_arg: 2,
		func: function(nameA, name2A) {
			var name = this.evaluateAsString(nameA);
			var name2 = defined(name2A) ? this.evaluateAsString(name2A) : name;
			var obj;
			if ("process" in global && "release" in global.process && "name" in global.process.release && global.process.release.name === "node") {
				try {
					obj = require(name2);
				} catch(e) {
					obj = global[name2];
				}
			} else {
				obj = global[name2];
			}
			if (defined(obj)) {
				this.addMacro(name, obj);
			} else {
				this.callback("NOMODULE", [name2]);
			}
		}
	},
// eval
	{
		name: "eval",
		min_arg: 1,
		func: function(exprA) {
			var argsA = Array.from(arguments).slice(1);
			var expr = this.evaluateAsString(exprA);
			var args = argsA.map(function(argA) {
				return this.evaluateAsObject(argA);
			}, this);
			var result = evalExpr(expr, args);
			return result;
		}
	},
// system
	{
		name: "system",
		num_arg: 1,
		func: function(commandA) {
			var child_process = require("child_process");
			var command = this.evaluateAsString(commandA);
			var r =  child_process.spawnSync(command, { shell: true });
			process.stdout.write(r.stdout);
			process.stderr.write(r.stderr);
			return r.status;
		}
	},
];

if ("process" in global && "release" in global.process && "name" in global.process.release && global.process.release.name === "node") {
	module.exports = MacroText;
} else {
	global.MacroText = MacroText;
}

// for debug
if (typeof process === "object" && process.argv instanceof Array && typeof __filename !== "undefined" && process.argv[1] === __filename) {
	(function() {
	var argv = process.argv.slice(2);
	var callback = function(code, src, getMsg) {
		var type = mt.getMessageType(code);
		if (type === "Debug") {
			// return;
		}
		var pos = src.pos;
		var len = src.len;
		var tag = src.tag;
		var file = defined(tag.file) ? tag.file : "-";
		var msg = getMsg();
		console.log("%s:%s:%s:%s: %s", file, pos, len, type, msg);
	};
	var mt = MacroText.create({ allowSystem: true, callback: callback });
	var text = argv[0] || "";
	console.log(text);
	var node = mt.parse(text, { });
	// console.log(node);
	console.log(node.toString());
	var value = mt.evaluate(node);
	// console.log(value);
	console.log(value.toString());
	})();
}

})(Function("return this")());
