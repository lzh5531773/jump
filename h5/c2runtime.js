
window["cr_getC2Runtime"] = function()
{
	var canvas = document.getElementById("c2canvas");
	if (canvas)
		return canvas["c2runtime"];
	else if (window["c2runtime"])
		return window["c2runtime"];
	else
		return null;
}
window["cr_setSuspended"] = function(s) {
	var runtime = window["cr_getC2Runtime"]();
	if (runtime)
		runtime["setSuspended"](s);
}




cr.shaders = {};

cr.plugins_.AJAX = function(runtime)
{
	this.runtime = runtime;
};
(function () {
	var isNWjs = false;
	var path = null;
	var fs = null;
	var nw_appfolder = "";
	var pluginProto = cr.plugins_.AJAX.prototype;
	pluginProto.Type = function (plugin) {
		this.plugin = plugin;
		this.runtime = plugin.runtime;
	};
	var typeProto = pluginProto.Type.prototype;
	typeProto.onCreate = function () {
	};
	pluginProto.Instance = function (type) {
		this.type = type;
		this.runtime = type.runtime;
		this.lastData = "";
		this.curTag = "";
		this.progress = 0;
		this.timeout = -1;
		isNWjs = this.runtime.isNWjs;
		if (isNWjs) {
			path = require("path");
			fs = require("fs");
			var process = window["process"] || nw["process"];
			nw_appfolder = path["dirname"](process["execPath"]) + "\\";
		}
	};
	var instanceProto = pluginProto.Instance.prototype;
	var theInstance = null;
	window["C2_AJAX_DCSide"] = function (event_, tag_, param_) {
		if (!theInstance)
			return;
		if (event_ === "success") {
			theInstance.curTag = tag_;
			theInstance.lastData = param_;
			theInstance.runtime.trigger(cr.plugins_.AJAX.prototype.cnds.OnAnyComplete, theInstance);
			theInstance.runtime.trigger(cr.plugins_.AJAX.prototype.cnds.OnComplete, theInstance);
		}
		else if (event_ === "error") {
			theInstance.curTag = tag_;
			theInstance.runtime.trigger(cr.plugins_.AJAX.prototype.cnds.OnAnyError, theInstance);
			theInstance.runtime.trigger(cr.plugins_.AJAX.prototype.cnds.OnError, theInstance);
		}
		else if (event_ === "progress") {
			theInstance.progress = param_;
			theInstance.curTag = tag_;
			theInstance.runtime.trigger(cr.plugins_.AJAX.prototype.cnds.OnProgress, theInstance);
		}
	};
	instanceProto.onCreate = function () {
		theInstance = this;
	};
	instanceProto.saveToJSON = function () {
		return {"lastData": this.lastData};
	};
	instanceProto.loadFromJSON = function (o) {
		this.lastData = o["lastData"];
		this.curTag = "";
		this.progress = 0;
	};
	var next_request_headers = {};
	var next_override_mime = "";
	instanceProto.doRequest = function (tag_, url_, method_, data_) {
		if (this.runtime.isDirectCanvas) {
			AppMobi["webview"]["execute"]('C2_AJAX_WebSide("' + tag_ + '", "' + url_ + '", "' + method_ + '", ' + (data_ ? '"' + data_ + '"' : "null") + ');');
			return;
		}
		var self = this;
		var request = null;
		var doErrorFunc = function () {
			self.curTag = tag_;
			self.runtime.trigger(cr.plugins_.AJAX.prototype.cnds.OnAnyError, self);
			self.runtime.trigger(cr.plugins_.AJAX.prototype.cnds.OnError, self);
		};
		var errorFunc = function () {
			if (isNWjs) {
				var filepath = nw_appfolder + url_;
				if (fs["existsSync"](filepath)) {
					fs["readFile"](filepath, {"encoding": "utf8"}, function (err, data) {
						if (err) {
							doErrorFunc();
							return;
						}
						self.curTag = tag_;
						self.lastData = data.replace(/\r\n/g, "\n")
						self.runtime.trigger(cr.plugins_.AJAX.prototype.cnds.OnAnyComplete, self);
						self.runtime.trigger(cr.plugins_.AJAX.prototype.cnds.OnComplete, self);
					});
				}
				else
					doErrorFunc();
			}
			else
				doErrorFunc();
		};
		var progressFunc = function (e) {
			if (!e["lengthComputable"])
				return;
			self.progress = e.loaded / e.total;
			self.curTag = tag_;
			self.runtime.trigger(cr.plugins_.AJAX.prototype.cnds.OnProgress, self);
		};
		try {
			if (this.runtime.isWindowsPhone8)
				request = new ActiveXObject("Microsoft.XMLHTTP");
			else
				request = new XMLHttpRequest();
			request.onreadystatechange = function () {
				if (request.readyState === 4) {
					self.curTag = tag_;
					if (request.responseText)
						self.lastData = request.responseText.replace(/\r\n/g, "\n");		// fix windows style line endings
					else
						self.lastData = "";
					if (request.status >= 400) {
						self.runtime.trigger(cr.plugins_.AJAX.prototype.cnds.OnAnyError, self);
						self.runtime.trigger(cr.plugins_.AJAX.prototype.cnds.OnError, self);
					}
					else {
						if ((!isNWjs || self.lastData.length) && !(!isNWjs && request.status === 0 && !self.lastData.length)) {
							self.runtime.trigger(cr.plugins_.AJAX.prototype.cnds.OnAnyComplete, self);
							self.runtime.trigger(cr.plugins_.AJAX.prototype.cnds.OnComplete, self);
						}
					}
				}
			};
			if (!this.runtime.isWindowsPhone8) {
				request.onerror = errorFunc;
				request.ontimeout = errorFunc;
				request.onabort = errorFunc;
				request["onprogress"] = progressFunc;
			}
			request.open(method_, url_);
			if (!this.runtime.isWindowsPhone8) {
				if (this.timeout >= 0 && typeof request["timeout"] !== "undefined")
					request["timeout"] = this.timeout;
			}
			try {
				request.responseType = "text";
			} catch (e) {
			}
			if (data_) {
				if (request["setRequestHeader"] && !next_request_headers.hasOwnProperty("Content-Type")) {
					request["setRequestHeader"]("Content-Type", "application/x-www-form-urlencoded");
				}
			}
			if (request["setRequestHeader"]) {
				var p;
				for (p in next_request_headers) {
					if (next_request_headers.hasOwnProperty(p)) {
						try {
							request["setRequestHeader"](p, next_request_headers[p]);
						}
						catch (e) {
						}
					}
				}
				next_request_headers = {};
			}
			if (next_override_mime && request["overrideMimeType"]) {
				try {
					request["overrideMimeType"](next_override_mime);
				}
				catch (e) {
				}
				next_override_mime = "";
			}
			if (data_)
				request.send(data_);
			else
				request.send();
		}
		catch (e) {
			errorFunc();
		}
	};

	function Cnds() {
	};
	Cnds.prototype.OnComplete = function (tag) {
		return cr.equals_nocase(tag, this.curTag);
	};
	Cnds.prototype.OnAnyComplete = function (tag) {
		return true;
	};
	Cnds.prototype.OnError = function (tag) {
		return cr.equals_nocase(tag, this.curTag);
	};
	Cnds.prototype.OnAnyError = function (tag) {
		return true;
	};
	Cnds.prototype.OnProgress = function (tag) {
		return cr.equals_nocase(tag, this.curTag);
	};
	pluginProto.cnds = new Cnds();

	function Acts() {
	};
	Acts.prototype.Request = function (tag_, url_) {
		var self = this;
		if (this.runtime.isWKWebView && !this.runtime.isAbsoluteUrl(url_)) {
			this.runtime.fetchLocalFileViaCordovaAsText(url_,
				function (str) {
					self.curTag = tag_;
					self.lastData = str.replace(/\r\n/g, "\n");		// fix windows style line endings
					self.runtime.trigger(cr.plugins_.AJAX.prototype.cnds.OnAnyComplete, self);
					self.runtime.trigger(cr.plugins_.AJAX.prototype.cnds.OnComplete, self);
				},
				function (err) {
					self.curTag = tag_;
					self.runtime.trigger(cr.plugins_.AJAX.prototype.cnds.OnAnyError, self);
					self.runtime.trigger(cr.plugins_.AJAX.prototype.cnds.OnError, self);
				});
		}
		else {
			this.doRequest(tag_, url_, "GET");
		}
	};
	Acts.prototype.RequestFile = function (tag_, file_) {
		var self = this;
		if (this.runtime.isWKWebView) {
			this.runtime.fetchLocalFileViaCordovaAsText(file_,
				function (str) {
					self.curTag = tag_;
					self.lastData = str.replace(/\r\n/g, "\n");		// fix windows style line endings
					self.runtime.trigger(cr.plugins_.AJAX.prototype.cnds.OnAnyComplete, self);
					self.runtime.trigger(cr.plugins_.AJAX.prototype.cnds.OnComplete, self);
				},
				function (err) {
					self.curTag = tag_;
					self.runtime.trigger(cr.plugins_.AJAX.prototype.cnds.OnAnyError, self);
					self.runtime.trigger(cr.plugins_.AJAX.prototype.cnds.OnError, self);
				});
		}
		else {
			this.doRequest(tag_, file_, "GET");
		}
	};
	Acts.prototype.Post = function (tag_, url_, data_, method_) {
		this.doRequest(tag_, url_, method_, data_);
	};
	Acts.prototype.SetTimeout = function (t) {
		this.timeout = t * 1000;
	};
	Acts.prototype.SetHeader = function (n, v) {
		next_request_headers[n] = v;
	};
	Acts.prototype.OverrideMIMEType = function (m) {
		next_override_mime = m;
	};
	pluginProto.acts = new Acts();

	function Exps() {
	};
	Exps.prototype.LastData = function (ret) {
		ret.set_string(this.lastData);
	};
	Exps.prototype.Progress = function (ret) {
		ret.set_float(this.progress);
	};
	Exps.prototype.Tag = function (ret) {
		ret.set_string(this.curTag);
	};
	pluginProto.exps = new Exps();
}());

cr.plugins_.Arr = function(runtime)
{
	this.runtime = runtime;
};
(function () {
	var pluginProto = cr.plugins_.Arr.prototype;
	pluginProto.Type = function (plugin) {
		this.plugin = plugin;
		this.runtime = plugin.runtime;
	};
	var typeProto = pluginProto.Type.prototype;
	typeProto.onCreate = function () {
	};
	pluginProto.Instance = function (type) {
		this.type = type;
		this.runtime = type.runtime;
	};
	var instanceProto = pluginProto.Instance.prototype;
	var arrCache = [];

	function allocArray() {
		if (arrCache.length)
			return arrCache.pop();
		else
			return [];
	};
	if (!Array.isArray) {
		Array.isArray = function (vArg) {
			return Object.prototype.toString.call(vArg) === "[object Array]";
		};
	}

	function freeArray(a) {
		var i, len;
		for (i = 0, len = a.length; i < len; i++) {
			if (Array.isArray(a[i]))
				freeArray(a[i]);
		}
		cr.clearArray(a);
		arrCache.push(a);
	};
	instanceProto.onCreate = function () {
		this.cx = this.properties[0];
		this.cy = this.properties[1];
		this.cz = this.properties[2];
		if (!this.recycled)
			this.arr = allocArray();
		var a = this.arr;
		a.length = this.cx;
		var x, y, z;
		for (x = 0; x < this.cx; x++) {
			if (!a[x])
				a[x] = allocArray();
			a[x].length = this.cy;
			for (y = 0; y < this.cy; y++) {
				if (!a[x][y])
					a[x][y] = allocArray();
				a[x][y].length = this.cz;
				for (z = 0; z < this.cz; z++)
					a[x][y][z] = 0;
			}
		}
		this.forX = [];
		this.forY = [];
		this.forZ = [];
		this.forDepth = -1;
	};
	instanceProto.onDestroy = function () {
		var x;
		for (x = 0; x < this.cx; x++)
			freeArray(this.arr[x]);		// will recurse down and recycle other arrays
		cr.clearArray(this.arr);
	};
	instanceProto.at = function (x, y, z) {
		x = Math.floor(x);
		y = Math.floor(y);
		z = Math.floor(z);
		if (isNaN(x) || x < 0 || x > this.cx - 1)
			return 0;
		if (isNaN(y) || y < 0 || y > this.cy - 1)
			return 0;
		if (isNaN(z) || z < 0 || z > this.cz - 1)
			return 0;
		return this.arr[x][y][z];
	};
	instanceProto.set = function (x, y, z, val) {
		x = Math.floor(x);
		y = Math.floor(y);
		z = Math.floor(z);
		if (isNaN(x) || x < 0 || x > this.cx - 1)
			return;
		if (isNaN(y) || y < 0 || y > this.cy - 1)
			return;
		if (isNaN(z) || z < 0 || z > this.cz - 1)
			return;
		this.arr[x][y][z] = val;
	};
	instanceProto.getAsJSON = function () {
		return JSON.stringify({
			"c2array": true,
			"size": [this.cx, this.cy, this.cz],
			"data": this.arr
		});
	};
	instanceProto.saveToJSON = function () {
		return {
			"size": [this.cx, this.cy, this.cz],
			"data": this.arr
		};
	};
	instanceProto.loadFromJSON = function (o) {
		var sz = o["size"];
		this.cx = sz[0];
		this.cy = sz[1];
		this.cz = sz[2];
		this.arr = o["data"];
	};
	instanceProto.setSize = function (w, h, d) {
		if (w < 0) w = 0;
		if (h < 0) h = 0;
		if (d < 0) d = 0;
		if (this.cx === w && this.cy === h && this.cz === d)
			return;		// no change
		this.cx = w;
		this.cy = h;
		this.cz = d;
		var x, y, z;
		var a = this.arr;
		a.length = w;
		for (x = 0; x < this.cx; x++) {
			if (cr.is_undefined(a[x]))
				a[x] = allocArray();
			a[x].length = h;
			for (y = 0; y < this.cy; y++) {
				if (cr.is_undefined(a[x][y]))
					a[x][y] = allocArray();
				a[x][y].length = d;
				for (z = 0; z < this.cz; z++) {
					if (cr.is_undefined(a[x][y][z]))
						a[x][y][z] = 0;
				}
			}
		}
	};
	instanceProto.getForX = function () {
		if (this.forDepth >= 0 && this.forDepth < this.forX.length)
			return this.forX[this.forDepth];
		else
			return 0;
	};
	instanceProto.getForY = function () {
		if (this.forDepth >= 0 && this.forDepth < this.forY.length)
			return this.forY[this.forDepth];
		else
			return 0;
	};
	instanceProto.getForZ = function () {
		if (this.forDepth >= 0 && this.forDepth < this.forZ.length)
			return this.forZ[this.forDepth];
		else
			return 0;
	};

	function Cnds() {
	};
	Cnds.prototype.CompareX = function (x, cmp, val) {
		return cr.do_cmp(this.at(x, 0, 0), cmp, val);
	};
	Cnds.prototype.CompareXY = function (x, y, cmp, val) {
		return cr.do_cmp(this.at(x, y, 0), cmp, val);
	};
	Cnds.prototype.CompareXYZ = function (x, y, z, cmp, val) {
		return cr.do_cmp(this.at(x, y, z), cmp, val);
	};
	instanceProto.doForEachTrigger = function (current_event) {
		this.runtime.pushCopySol(current_event.solModifiers);
		current_event.retrigger();
		this.runtime.popSol(current_event.solModifiers);
	};
	Cnds.prototype.ArrForEach = function (dims) {
		var current_event = this.runtime.getCurrentEventStack().current_event;
		this.forDepth++;
		var forDepth = this.forDepth;
		if (forDepth === this.forX.length) {
			this.forX.push(0);
			this.forY.push(0);
			this.forZ.push(0);
		}
		else {
			this.forX[forDepth] = 0;
			this.forY[forDepth] = 0;
			this.forZ[forDepth] = 0;
		}
		switch (dims) {
			case 0:
				for (this.forX[forDepth] = 0; this.forX[forDepth] < this.cx; this.forX[forDepth]++) {
					for (this.forY[forDepth] = 0; this.forY[forDepth] < this.cy; this.forY[forDepth]++) {
						for (this.forZ[forDepth] = 0; this.forZ[forDepth] < this.cz; this.forZ[forDepth]++) {
							this.doForEachTrigger(current_event);
						}
					}
				}
				break;
			case 1:
				for (this.forX[forDepth] = 0; this.forX[forDepth] < this.cx; this.forX[forDepth]++) {
					for (this.forY[forDepth] = 0; this.forY[forDepth] < this.cy; this.forY[forDepth]++) {
						this.doForEachTrigger(current_event);
					}
				}
				break;
			case 2:
				for (this.forX[forDepth] = 0; this.forX[forDepth] < this.cx; this.forX[forDepth]++) {
					this.doForEachTrigger(current_event);
				}
				break;
		}
		this.forDepth--;
		return false;
	};
	Cnds.prototype.CompareCurrent = function (cmp, val) {
		return cr.do_cmp(this.at(this.getForX(), this.getForY(), this.getForZ()), cmp, val);
	};
	Cnds.prototype.Contains = function (val) {
		var x, y, z;
		for (x = 0; x < this.cx; x++) {
			for (y = 0; y < this.cy; y++) {
				for (z = 0; z < this.cz; z++) {
					if (this.arr[x][y][z] === val)
						return true;
				}
			}
		}
		return false;
	};
	Cnds.prototype.IsEmpty = function () {
		return this.cx === 0 || this.cy === 0 || this.cz === 0;
	};
	Cnds.prototype.CompareSize = function (axis, cmp, value) {
		var s = 0;
		switch (axis) {
			case 0:
				s = this.cx;
				break;
			case 1:
				s = this.cy;
				break;
			case 2:
				s = this.cz;
				break;
		}
		return cr.do_cmp(s, cmp, value);
	};
	pluginProto.cnds = new Cnds();

	function Acts() {
	};
	Acts.prototype.Clear = function () {
		var x, y, z;
		for (x = 0; x < this.cx; x++)
			for (y = 0; y < this.cy; y++)
				for (z = 0; z < this.cz; z++)
					this.arr[x][y][z] = 0;
	};
	Acts.prototype.SetSize = function (w, h, d) {
		this.setSize(w, h, d);
	};
	Acts.prototype.SetX = function (x, val) {
		this.set(x, 0, 0, val);
	};
	Acts.prototype.SetXY = function (x, y, val) {
		this.set(x, y, 0, val);
	};
	Acts.prototype.SetXYZ = function (x, y, z, val) {
		this.set(x, y, z, val);
	};
	Acts.prototype.Push = function (where, value, axis) {
		var x = 0, y = 0, z = 0;
		var a = this.arr;
		switch (axis) {
			case 0:	// X axis
				if (where === 0)	// back
				{
					x = a.length;
					a.push(allocArray());
				}
				else				// front
				{
					x = 0;
					a.unshift(allocArray());
				}
				a[x].length = this.cy;
				for (; y < this.cy; y++) {
					a[x][y] = allocArray();
					a[x][y].length = this.cz;
					for (z = 0; z < this.cz; z++)
						a[x][y][z] = value;
				}
				this.cx++;
				break;
			case 1: // Y axis
				for (; x < this.cx; x++) {
					if (where === 0)	// back
					{
						y = a[x].length;
						a[x].push(allocArray());
					}
					else				// front
					{
						y = 0;
						a[x].unshift(allocArray());
					}
					a[x][y].length = this.cz;
					for (z = 0; z < this.cz; z++)
						a[x][y][z] = value;
				}
				this.cy++;
				break;
			case 2:	// Z axis
				for (; x < this.cx; x++) {
					for (y = 0; y < this.cy; y++) {
						if (where === 0)	// back
						{
							a[x][y].push(value);
						}
						else				// front
						{
							a[x][y].unshift(value);
						}
					}
				}
				this.cz++;
				break;
		}
	};
	Acts.prototype.Pop = function (where, axis) {
		var x = 0, y = 0, z = 0;
		var a = this.arr;
		switch (axis) {
			case 0:	// X axis
				if (this.cx === 0)
					break;
				if (where === 0)	// back
				{
					freeArray(a.pop());
				}
				else				// front
				{
					freeArray(a.shift());
				}
				this.cx--;
				break;
			case 1: // Y axis
				if (this.cy === 0)
					break;
				for (; x < this.cx; x++) {
					if (where === 0)	// back
					{
						freeArray(a[x].pop());
					}
					else				// front
					{
						freeArray(a[x].shift());
					}
				}
				this.cy--;
				break;
			case 2:	// Z axis
				if (this.cz === 0)
					break;
				for (; x < this.cx; x++) {
					for (y = 0; y < this.cy; y++) {
						if (where === 0)	// back
						{
							a[x][y].pop();
						}
						else				// front
						{
							a[x][y].shift();
						}
					}
				}
				this.cz--;
				break;
		}
	};
	Acts.prototype.Reverse = function (axis) {
		var x = 0, y = 0, z = 0;
		var a = this.arr;
		if (this.cx === 0 || this.cy === 0 || this.cz === 0)
			return;		// no point reversing empty array
		switch (axis) {
			case 0:	// X axis
				a.reverse();
				break;
			case 1: // Y axis
				for (; x < this.cx; x++)
					a[x].reverse();
				break;
			case 2:	// Z axis
				for (; x < this.cx; x++)
					for (y = 0; y < this.cy; y++)
						a[x][y].reverse();
				this.cz--;
				break;
		}
	};

	function compareValues(va, vb) {
		if (cr.is_number(va) && cr.is_number(vb))
			return va - vb;
		else {
			var sa = "" + va;
			var sb = "" + vb;
			if (sa < sb)
				return -1;
			else if (sa > sb)
				return 1;
			else
				return 0;
		}
	}

	Acts.prototype.Sort = function (axis) {
		var x = 0, y = 0, z = 0;
		var a = this.arr;
		if (this.cx === 0 || this.cy === 0 || this.cz === 0)
			return;		// no point sorting empty array
		switch (axis) {
			case 0:	// X axis
				a.sort(function (a, b) {
					return compareValues(a[0][0], b[0][0]);
				});
				break;
			case 1: // Y axis
				for (; x < this.cx; x++) {
					a[x].sort(function (a, b) {
						return compareValues(a[0], b[0]);
					});
				}
				break;
			case 2:	// Z axis
				for (; x < this.cx; x++) {
					for (y = 0; y < this.cy; y++) {
						a[x][y].sort(compareValues);
					}
				}
				break;
		}
	};
	Acts.prototype.Delete = function (index, axis) {
		var x = 0, y = 0, z = 0;
		index = Math.floor(index);
		var a = this.arr;
		if (index < 0)
			return;
		switch (axis) {
			case 0:	// X axis
				if (index >= this.cx)
					break;
				freeArray(a[index]);
				a.splice(index, 1);
				this.cx--;
				break;
			case 1: // Y axis
				if (index >= this.cy)
					break;
				for (; x < this.cx; x++) {
					freeArray(a[x][index]);
					a[x].splice(index, 1);
				}
				this.cy--;
				break;
			case 2:	// Z axis
				if (index >= this.cz)
					break;
				for (; x < this.cx; x++) {
					for (y = 0; y < this.cy; y++) {
						a[x][y].splice(index, 1);
					}
				}
				this.cz--;
				break;
		}
	};
	Acts.prototype.Insert = function (value, index, axis) {
		var x = 0, y = 0, z = 0;
		index = Math.floor(index);
		var a = this.arr;
		if (index < 0)
			return;
		switch (axis) {
			case 0:	// X axis
				if (index > this.cx)
					return;
				x = index;
				a.splice(x, 0, allocArray());
				a[x].length = this.cy;
				for (; y < this.cy; y++) {
					a[x][y] = allocArray();
					a[x][y].length = this.cz;
					for (z = 0; z < this.cz; z++)
						a[x][y][z] = value;
				}
				this.cx++;
				break;
			case 1: // Y axis
				if (index > this.cy)
					return;
				for (; x < this.cx; x++) {
					y = index;
					a[x].splice(y, 0, allocArray());
					a[x][y].length = this.cz;
					for (z = 0; z < this.cz; z++)
						a[x][y][z] = value;
				}
				this.cy++;
				break;
			case 2:	// Z axis
				if (index > this.cz)
					return;
				for (; x < this.cx; x++) {
					for (y = 0; y < this.cy; y++) {
						a[x][y].splice(index, 0, value);
					}
				}
				this.cz++;
				break;
		}
	};
	Acts.prototype.JSONLoad = function (json_) {
		var o;
		try {
			o = JSON.parse(json_);
		}
		catch (e) {
			return;
		}
		if (!o["c2array"])		// presumably not a c2array object
			return;
		var sz = o["size"];
		this.cx = sz[0];
		this.cy = sz[1];
		this.cz = sz[2];
		this.arr = o["data"];
	};
	//Acts.prototype.JSONDownload = function (filename)
//	{
//		var a = document.createElement("a");
//		if (typeof a.download === "undefined")
//		{
//			var str = 'data:text/html,' + encodeURIComponent("<p><a download='" + filename + "' href=\"data:application/json,"
//				+ encodeURIComponent(this.getAsJSON())
//				+ "\">Download link</a></p>");
//			window.open(str);
//		}
//		else
//		{
//			var body = document.getElementsByTagName("body")[0];
//			a.textContent = filename;
//			a.href = "data:application/json," + encodeURIComponent(this.getAsJSON());
//			a.download = filename;
//			body.appendChild(a);
//			var clickEvent = document.createEvent("MouseEvent");
//			clickEvent.initMouseEvent("click", true, true, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
//			a.dispatchEvent(clickEvent);
//			body.removeChild(a);
//		}
//	};
	pluginProto.acts = new Acts();

	function Exps() {
	};
	Exps.prototype.At = function (ret, x, y_, z_) {
		var y = y_ || 0;
		var z = z_ || 0;
		ret.set_any(this.at(x, y, z));
	};
	Exps.prototype.Width = function (ret) {
		ret.set_int(this.cx);
	};
	Exps.prototype.Height = function (ret) {
		ret.set_int(this.cy);
	};
	Exps.prototype.Depth = function (ret) {
		ret.set_int(this.cz);
	};
	Exps.prototype.CurX = function (ret) {
		ret.set_int(this.getForX());
	};
	Exps.prototype.CurY = function (ret) {
		ret.set_int(this.getForY());
	};
	Exps.prototype.CurZ = function (ret) {
		ret.set_int(this.getForZ());
	};
	Exps.prototype.CurValue = function (ret) {
		ret.set_any(this.at(this.getForX(), this.getForY(), this.getForZ()));
	};
	Exps.prototype.Front = function (ret) {
		ret.set_any(this.at(0, 0, 0));
	};
	Exps.prototype.Back = function (ret) {
		ret.set_any(this.at(this.cx - 1, 0, 0));
	};
	Exps.prototype.IndexOf = function (ret, v) {
		for (var i = 0; i < this.cx; i++) {
			if (this.arr[i][0][0] === v) {
				ret.set_int(i);
				return;
			}
		}
		ret.set_int(-1);
	};
	Exps.prototype.LastIndexOf = function (ret, v) {
		for (var i = this.cx - 1; i >= 0; i--) {
			if (this.arr[i][0][0] === v) {
				ret.set_int(i);
				return;
			}
		}
		ret.set_int(-1);
	};
	Exps.prototype.AsJSON = function (ret) {
		ret.set_string(this.getAsJSON());
	};
	pluginProto.exps = new Exps();
}());

cr.plugins_.Audio = function(runtime)
{
	this.runtime = runtime;
};
(function () {
	var pluginProto = cr.plugins_.Audio.prototype;
	pluginProto.Type = function (plugin) {
		this.plugin = plugin;
		this.runtime = plugin.runtime;
	};
	var typeProto = pluginProto.Type.prototype;
	typeProto.onCreate = function () {
	};
	var audRuntime = null;
	var audInst = null;
	var audTag = "";
	var appPath = "";			// for Cordova only
	var API_HTML5 = 0;
	var API_WEBAUDIO = 1;
	var API_CORDOVA = 2;
	var API_APPMOBI = 3;
	var api = API_HTML5;
	var context = null;
	var audioBuffers = [];		// cache of buffers
	var audioInstances = [];	// cache of instances
	var lastAudio = null;
	var useOgg = false;			// determined at create time
	var timescale_mode = 0;
	var silent = false;
	var masterVolume = 1;
	var listenerX = 0;
	var listenerY = 0;
	var isContextSuspended = false;
	var panningModel = 1;		// HRTF
	var distanceModel = 1;		// Inverse
	var refDistance = 10;
	var maxDistance = 10000;
	var rolloffFactor = 1;
	var micSource = null;
	var micTag = "";
	var isMusicWorkaround = false;
	var musicPlayNextTouch = [];
	var playMusicAsSoundWorkaround = false;		// play music tracks with Web Audio API
	function dbToLinear(x) {
		var v = dbToLinear_nocap(x);
		if (!isFinite(v))	// accidentally passing a string can result in NaN; set volume to 0 if so
			v = 0;
		if (v < 0)
			v = 0;
		if (v > 1)
			v = 1;
		return v;
	};

	function linearToDb(x) {
		if (x < 0)
			x = 0;
		if (x > 1)
			x = 1;
		return linearToDb_nocap(x);
	};

	function dbToLinear_nocap(x) {
		return Math.pow(10, x / 20);
	};

	function linearToDb_nocap(x) {
		return (Math.log(x) / Math.log(10)) * 20;
	};
	var effects = {};

	function getDestinationForTag(tag) {
		tag = tag.toLowerCase();
		if (effects.hasOwnProperty(tag)) {
			if (effects[tag].length)
				return effects[tag][0].getInputNode();
		}
		return context["destination"];
	};

	function createGain() {
		if (context["createGain"])
			return context["createGain"]();
		else
			return context["createGainNode"]();
	};

	function createDelay(d) {
		if (context["createDelay"])
			return context["createDelay"](d);
		else
			return context["createDelayNode"](d);
	};

	function startSource(s, scheduledTime) {
		if (s["start"])
			s["start"](scheduledTime || 0);
		else
			s["noteOn"](scheduledTime || 0);
	};

	function startSourceAt(s, x, d, scheduledTime) {
		if (s["start"])
			s["start"](scheduledTime || 0, x);
		else
			s["noteGrainOn"](scheduledTime || 0, x, d - x);
	};

	function stopSource(s) {
		try {
			if (s["stop"])
				s["stop"](0);
			else
				s["noteOff"](0);
		}
		catch (e) {
		}
	};

	function setAudioParam(ap, value, ramp, time) {
		if (!ap)
			return;		// iOS is missing some parameters
		ap["cancelScheduledValues"](0);
		if (time === 0) {
			ap["value"] = value;
			return;
		}
		var curTime = context["currentTime"];
		time += curTime;
		switch (ramp) {
			case 0:		// step
				ap["setValueAtTime"](value, time);
				break;
			case 1:		// linear
				ap["setValueAtTime"](ap["value"], curTime);		// to set what to ramp from
				ap["linearRampToValueAtTime"](value, time);
				break;
			case 2:		// exponential
				ap["setValueAtTime"](ap["value"], curTime);		// to set what to ramp from
				ap["exponentialRampToValueAtTime"](value, time);
				break;
		}
	};
	var filterTypes = ["lowpass", "highpass", "bandpass", "lowshelf", "highshelf", "peaking", "notch", "allpass"];

	function FilterEffect(type, freq, detune, q, gain, mix) {
		this.type = "filter";
		this.params = [type, freq, detune, q, gain, mix];
		this.inputNode = createGain();
		this.wetNode = createGain();
		this.wetNode["gain"]["value"] = mix;
		this.dryNode = createGain();
		this.dryNode["gain"]["value"] = 1 - mix;
		this.filterNode = context["createBiquadFilter"]();
		if (typeof this.filterNode["type"] === "number")
			this.filterNode["type"] = type;
		else
			this.filterNode["type"] = filterTypes[type];
		this.filterNode["frequency"]["value"] = freq;
		if (this.filterNode["detune"])		// iOS 6 doesn't have detune yet
			this.filterNode["detune"]["value"] = detune;
		this.filterNode["Q"]["value"] = q;
		this.filterNode["gain"]["value"] = gain;
		this.inputNode["connect"](this.filterNode);
		this.inputNode["connect"](this.dryNode);
		this.filterNode["connect"](this.wetNode);
	};
	FilterEffect.prototype.connectTo = function (node) {
		this.wetNode["disconnect"]();
		this.wetNode["connect"](node);
		this.dryNode["disconnect"]();
		this.dryNode["connect"](node);
	};
	FilterEffect.prototype.remove = function () {
		this.inputNode["disconnect"]();
		this.filterNode["disconnect"]();
		this.wetNode["disconnect"]();
		this.dryNode["disconnect"]();
	};
	FilterEffect.prototype.getInputNode = function () {
		return this.inputNode;
	};
	FilterEffect.prototype.setParam = function (param, value, ramp, time) {
		switch (param) {
			case 0:		// mix
				value = value / 100;
				if (value < 0) value = 0;
				if (value > 1) value = 1;
				this.params[5] = value;
				setAudioParam(this.wetNode["gain"], value, ramp, time);
				setAudioParam(this.dryNode["gain"], 1 - value, ramp, time);
				break;
			case 1:		// filter frequency
				this.params[1] = value;
				setAudioParam(this.filterNode["frequency"], value, ramp, time);
				break;
			case 2:		// filter detune
				this.params[2] = value;
				setAudioParam(this.filterNode["detune"], value, ramp, time);
				break;
			case 3:		// filter Q
				this.params[3] = value;
				setAudioParam(this.filterNode["Q"], value, ramp, time);
				break;
			case 4:		// filter/delay gain (note value is in dB here)
				this.params[4] = value;
				setAudioParam(this.filterNode["gain"], value, ramp, time);
				break;
		}
	};

	function DelayEffect(delayTime, delayGain, mix) {
		this.type = "delay";
		this.params = [delayTime, delayGain, mix];
		this.inputNode = createGain();
		this.wetNode = createGain();
		this.wetNode["gain"]["value"] = mix;
		this.dryNode = createGain();
		this.dryNode["gain"]["value"] = 1 - mix;
		this.mainNode = createGain();
		this.delayNode = createDelay(delayTime);
		this.delayNode["delayTime"]["value"] = delayTime;
		this.delayGainNode = createGain();
		this.delayGainNode["gain"]["value"] = delayGain;
		this.inputNode["connect"](this.mainNode);
		this.inputNode["connect"](this.dryNode);
		this.mainNode["connect"](this.wetNode);
		this.mainNode["connect"](this.delayNode);
		this.delayNode["connect"](this.delayGainNode);
		this.delayGainNode["connect"](this.mainNode);
	};
	DelayEffect.prototype.connectTo = function (node) {
		this.wetNode["disconnect"]();
		this.wetNode["connect"](node);
		this.dryNode["disconnect"]();
		this.dryNode["connect"](node);
	};
	DelayEffect.prototype.remove = function () {
		this.inputNode["disconnect"]();
		this.mainNode["disconnect"]();
		this.delayNode["disconnect"]();
		this.delayGainNode["disconnect"]();
		this.wetNode["disconnect"]();
		this.dryNode["disconnect"]();
	};
	DelayEffect.prototype.getInputNode = function () {
		return this.inputNode;
	};
	DelayEffect.prototype.setParam = function (param, value, ramp, time) {
		switch (param) {
			case 0:		// mix
				value = value / 100;
				if (value < 0) value = 0;
				if (value > 1) value = 1;
				this.params[2] = value;
				setAudioParam(this.wetNode["gain"], value, ramp, time);
				setAudioParam(this.dryNode["gain"], 1 - value, ramp, time);
				break;
			case 4:		// filter/delay gain (note value is passed in dB but needs to be linear here)
				this.params[1] = dbToLinear(value);
				setAudioParam(this.delayGainNode["gain"], dbToLinear(value), ramp, time);
				break;
			case 5:		// delay time
				this.params[0] = value;
				setAudioParam(this.delayNode["delayTime"], value, ramp, time);
				break;
		}
	};

	function ConvolveEffect(buffer, normalize, mix, src) {
		this.type = "convolve";
		this.params = [normalize, mix, src];
		this.inputNode = createGain();
		this.wetNode = createGain();
		this.wetNode["gain"]["value"] = mix;
		this.dryNode = createGain();
		this.dryNode["gain"]["value"] = 1 - mix;
		this.convolveNode = context["createConvolver"]();
		if (buffer) {
			this.convolveNode["normalize"] = normalize;
			this.convolveNode["buffer"] = buffer;
		}
		this.inputNode["connect"](this.convolveNode);
		this.inputNode["connect"](this.dryNode);
		this.convolveNode["connect"](this.wetNode);
	};
	ConvolveEffect.prototype.connectTo = function (node) {
		this.wetNode["disconnect"]();
		this.wetNode["connect"](node);
		this.dryNode["disconnect"]();
		this.dryNode["connect"](node);
	};
	ConvolveEffect.prototype.remove = function () {
		this.inputNode["disconnect"]();
		this.convolveNode["disconnect"]();
		this.wetNode["disconnect"]();
		this.dryNode["disconnect"]();
	};
	ConvolveEffect.prototype.getInputNode = function () {
		return this.inputNode;
	};
	ConvolveEffect.prototype.setParam = function (param, value, ramp, time) {
		switch (param) {
			case 0:		// mix
				value = value / 100;
				if (value < 0) value = 0;
				if (value > 1) value = 1;
				this.params[1] = value;
				setAudioParam(this.wetNode["gain"], value, ramp, time);
				setAudioParam(this.dryNode["gain"], 1 - value, ramp, time);
				break;
		}
	};

	function FlangerEffect(delay, modulation, freq, feedback, mix) {
		this.type = "flanger";
		this.params = [delay, modulation, freq, feedback, mix];
		this.inputNode = createGain();
		this.dryNode = createGain();
		this.dryNode["gain"]["value"] = 1 - (mix / 2);
		this.wetNode = createGain();
		this.wetNode["gain"]["value"] = mix / 2;
		this.feedbackNode = createGain();
		this.feedbackNode["gain"]["value"] = feedback;
		this.delayNode = createDelay(delay + modulation);
		this.delayNode["delayTime"]["value"] = delay;
		this.oscNode = context["createOscillator"]();
		this.oscNode["frequency"]["value"] = freq;
		this.oscGainNode = createGain();
		this.oscGainNode["gain"]["value"] = modulation;
		this.inputNode["connect"](this.delayNode);
		this.inputNode["connect"](this.dryNode);
		this.delayNode["connect"](this.wetNode);
		this.delayNode["connect"](this.feedbackNode);
		this.feedbackNode["connect"](this.delayNode);
		this.oscNode["connect"](this.oscGainNode);
		this.oscGainNode["connect"](this.delayNode["delayTime"]);
		startSource(this.oscNode);
	};
	FlangerEffect.prototype.connectTo = function (node) {
		this.dryNode["disconnect"]();
		this.dryNode["connect"](node);
		this.wetNode["disconnect"]();
		this.wetNode["connect"](node);
	};
	FlangerEffect.prototype.remove = function () {
		this.inputNode["disconnect"]();
		this.delayNode["disconnect"]();
		this.oscNode["disconnect"]();
		this.oscGainNode["disconnect"]();
		this.dryNode["disconnect"]();
		this.wetNode["disconnect"]();
		this.feedbackNode["disconnect"]();
	};
	FlangerEffect.prototype.getInputNode = function () {
		return this.inputNode;
	};
	FlangerEffect.prototype.setParam = function (param, value, ramp, time) {
		switch (param) {
			case 0:		// mix
				value = value / 100;
				if (value < 0) value = 0;
				if (value > 1) value = 1;
				this.params[4] = value;
				setAudioParam(this.wetNode["gain"], value / 2, ramp, time);
				setAudioParam(this.dryNode["gain"], 1 - (value / 2), ramp, time);
				break;
			case 6:		// modulation
				this.params[1] = value / 1000;
				setAudioParam(this.oscGainNode["gain"], value / 1000, ramp, time);
				break;
			case 7:		// modulation frequency
				this.params[2] = value;
				setAudioParam(this.oscNode["frequency"], value, ramp, time);
				break;
			case 8:		// feedback
				this.params[3] = value / 100;
				setAudioParam(this.feedbackNode["gain"], value / 100, ramp, time);
				break;
		}
	};

	function PhaserEffect(freq, detune, q, modulation, modfreq, mix) {
		this.type = "phaser";
		this.params = [freq, detune, q, modulation, modfreq, mix];
		this.inputNode = createGain();
		this.dryNode = createGain();
		this.dryNode["gain"]["value"] = 1 - (mix / 2);
		this.wetNode = createGain();
		this.wetNode["gain"]["value"] = mix / 2;
		this.filterNode = context["createBiquadFilter"]();
		if (typeof this.filterNode["type"] === "number")
			this.filterNode["type"] = 7;	// all-pass
		else
			this.filterNode["type"] = "allpass";
		this.filterNode["frequency"]["value"] = freq;
		if (this.filterNode["detune"])		// iOS 6 doesn't have detune yet
			this.filterNode["detune"]["value"] = detune;
		this.filterNode["Q"]["value"] = q;
		this.oscNode = context["createOscillator"]();
		this.oscNode["frequency"]["value"] = modfreq;
		this.oscGainNode = createGain();
		this.oscGainNode["gain"]["value"] = modulation;
		this.inputNode["connect"](this.filterNode);
		this.inputNode["connect"](this.dryNode);
		this.filterNode["connect"](this.wetNode);
		this.oscNode["connect"](this.oscGainNode);
		this.oscGainNode["connect"](this.filterNode["frequency"]);
		startSource(this.oscNode);
	};
	PhaserEffect.prototype.connectTo = function (node) {
		this.dryNode["disconnect"]();
		this.dryNode["connect"](node);
		this.wetNode["disconnect"]();
		this.wetNode["connect"](node);
	};
	PhaserEffect.prototype.remove = function () {
		this.inputNode["disconnect"]();
		this.filterNode["disconnect"]();
		this.oscNode["disconnect"]();
		this.oscGainNode["disconnect"]();
		this.dryNode["disconnect"]();
		this.wetNode["disconnect"]();
	};
	PhaserEffect.prototype.getInputNode = function () {
		return this.inputNode;
	};
	PhaserEffect.prototype.setParam = function (param, value, ramp, time) {
		switch (param) {
			case 0:		// mix
				value = value / 100;
				if (value < 0) value = 0;
				if (value > 1) value = 1;
				this.params[5] = value;
				setAudioParam(this.wetNode["gain"], value / 2, ramp, time);
				setAudioParam(this.dryNode["gain"], 1 - (value / 2), ramp, time);
				break;
			case 1:		// filter frequency
				this.params[0] = value;
				setAudioParam(this.filterNode["frequency"], value, ramp, time);
				break;
			case 2:		// filter detune
				this.params[1] = value;
				setAudioParam(this.filterNode["detune"], value, ramp, time);
				break;
			case 3:		// filter Q
				this.params[2] = value;
				setAudioParam(this.filterNode["Q"], value, ramp, time);
				break;
			case 6:		// modulation
				this.params[3] = value;
				setAudioParam(this.oscGainNode["gain"], value, ramp, time);
				break;
			case 7:		// modulation frequency
				this.params[4] = value;
				setAudioParam(this.oscNode["frequency"], value, ramp, time);
				break;
		}
	};

	function GainEffect(g) {
		this.type = "gain";
		this.params = [g];
		this.node = createGain();
		this.node["gain"]["value"] = g;
	};
	GainEffect.prototype.connectTo = function (node_) {
		this.node["disconnect"]();
		this.node["connect"](node_);
	};
	GainEffect.prototype.remove = function () {
		this.node["disconnect"]();
	};
	GainEffect.prototype.getInputNode = function () {
		return this.node;
	};
	GainEffect.prototype.setParam = function (param, value, ramp, time) {
		switch (param) {
			case 4:		// gain
				this.params[0] = dbToLinear(value);
				setAudioParam(this.node["gain"], dbToLinear(value), ramp, time);
				break;
		}
	};

	function TremoloEffect(freq, mix) {
		this.type = "tremolo";
		this.params = [freq, mix];
		this.node = createGain();
		this.node["gain"]["value"] = 1 - (mix / 2);
		this.oscNode = context["createOscillator"]();
		this.oscNode["frequency"]["value"] = freq;
		this.oscGainNode = createGain();
		this.oscGainNode["gain"]["value"] = mix / 2;
		this.oscNode["connect"](this.oscGainNode);
		this.oscGainNode["connect"](this.node["gain"]);
		startSource(this.oscNode);
	};
	TremoloEffect.prototype.connectTo = function (node_) {
		this.node["disconnect"]();
		this.node["connect"](node_);
	};
	TremoloEffect.prototype.remove = function () {
		this.oscNode["disconnect"]();
		this.oscGainNode["disconnect"]();
		this.node["disconnect"]();
	};
	TremoloEffect.prototype.getInputNode = function () {
		return this.node;
	};
	TremoloEffect.prototype.setParam = function (param, value, ramp, time) {
		switch (param) {
			case 0:		// mix
				value = value / 100;
				if (value < 0) value = 0;
				if (value > 1) value = 1;
				this.params[1] = value;
				setAudioParam(this.node["gain"]["value"], 1 - (value / 2), ramp, time);
				setAudioParam(this.oscGainNode["gain"]["value"], value / 2, ramp, time);
				break;
			case 7:		// modulation frequency
				this.params[0] = value;
				setAudioParam(this.oscNode["frequency"], value, ramp, time);
				break;
		}
	};

	function RingModulatorEffect(freq, mix) {
		this.type = "ringmod";
		this.params = [freq, mix];
		this.inputNode = createGain();
		this.wetNode = createGain();
		this.wetNode["gain"]["value"] = mix;
		this.dryNode = createGain();
		this.dryNode["gain"]["value"] = 1 - mix;
		this.ringNode = createGain();
		this.ringNode["gain"]["value"] = 0;
		this.oscNode = context["createOscillator"]();
		this.oscNode["frequency"]["value"] = freq;
		this.oscNode["connect"](this.ringNode["gain"]);
		startSource(this.oscNode);
		this.inputNode["connect"](this.ringNode);
		this.inputNode["connect"](this.dryNode);
		this.ringNode["connect"](this.wetNode);
	};
	RingModulatorEffect.prototype.connectTo = function (node_) {
		this.wetNode["disconnect"]();
		this.wetNode["connect"](node_);
		this.dryNode["disconnect"]();
		this.dryNode["connect"](node_);
	};
	RingModulatorEffect.prototype.remove = function () {
		this.oscNode["disconnect"]();
		this.ringNode["disconnect"]();
		this.inputNode["disconnect"]();
		this.wetNode["disconnect"]();
		this.dryNode["disconnect"]();
	};
	RingModulatorEffect.prototype.getInputNode = function () {
		return this.inputNode;
	};
	RingModulatorEffect.prototype.setParam = function (param, value, ramp, time) {
		switch (param) {
			case 0:		// mix
				value = value / 100;
				if (value < 0) value = 0;
				if (value > 1) value = 1;
				this.params[1] = value;
				setAudioParam(this.wetNode["gain"], value, ramp, time);
				setAudioParam(this.dryNode["gain"], 1 - value, ramp, time);
				break;
			case 7:		// modulation frequency
				this.params[0] = value;
				setAudioParam(this.oscNode["frequency"], value, ramp, time);
				break;
		}
	};

	function DistortionEffect(threshold, headroom, drive, makeupgain, mix) {
		this.type = "distortion";
		this.params = [threshold, headroom, drive, makeupgain, mix];
		this.inputNode = createGain();
		this.preGain = createGain();
		this.postGain = createGain();
		this.setDrive(drive, dbToLinear_nocap(makeupgain));
		this.wetNode = createGain();
		this.wetNode["gain"]["value"] = mix;
		this.dryNode = createGain();
		this.dryNode["gain"]["value"] = 1 - mix;
		this.waveShaper = context["createWaveShaper"]();
		this.curve = new Float32Array(65536);
		this.generateColortouchCurve(threshold, headroom);
		this.waveShaper.curve = this.curve;
		this.inputNode["connect"](this.preGain);
		this.inputNode["connect"](this.dryNode);
		this.preGain["connect"](this.waveShaper);
		this.waveShaper["connect"](this.postGain);
		this.postGain["connect"](this.wetNode);
	};
	DistortionEffect.prototype.setDrive = function (drive, makeupgain) {
		if (drive < 0.01)
			drive = 0.01;
		this.preGain["gain"]["value"] = drive;
		this.postGain["gain"]["value"] = Math.pow(1 / drive, 0.6) * makeupgain;
	};

	function e4(x, k) {
		return 1.0 - Math.exp(-k * x);
	}

	DistortionEffect.prototype.shape = function (x, linearThreshold, linearHeadroom) {
		var maximum = 1.05 * linearHeadroom * linearThreshold;
		var kk = (maximum - linearThreshold);
		var sign = x < 0 ? -1 : +1;
		var absx = x < 0 ? -x : x;
		var shapedInput = absx < linearThreshold ? absx : linearThreshold + kk * e4(absx - linearThreshold, 1.0 / kk);
		shapedInput *= sign;
		return shapedInput;
	};
	DistortionEffect.prototype.generateColortouchCurve = function (threshold, headroom) {
		var linearThreshold = dbToLinear_nocap(threshold);
		var linearHeadroom = dbToLinear_nocap(headroom);
		var n = 65536;
		var n2 = n / 2;
		var x = 0;
		for (var i = 0; i < n2; ++i) {
			x = i / n2;
			x = this.shape(x, linearThreshold, linearHeadroom);
			this.curve[n2 + i] = x;
			this.curve[n2 - i - 1] = -x;
		}
	};
	DistortionEffect.prototype.connectTo = function (node) {
		this.wetNode["disconnect"]();
		this.wetNode["connect"](node);
		this.dryNode["disconnect"]();
		this.dryNode["connect"](node);
	};
	DistortionEffect.prototype.remove = function () {
		this.inputNode["disconnect"]();
		this.preGain["disconnect"]();
		this.waveShaper["disconnect"]();
		this.postGain["disconnect"]();
		this.wetNode["disconnect"]();
		this.dryNode["disconnect"]();
	};
	DistortionEffect.prototype.getInputNode = function () {
		return this.inputNode;
	};
	DistortionEffect.prototype.setParam = function (param, value, ramp, time) {
		switch (param) {
			case 0:		// mix
				value = value / 100;
				if (value < 0) value = 0;
				if (value > 1) value = 1;
				this.params[4] = value;
				setAudioParam(this.wetNode["gain"], value, ramp, time);
				setAudioParam(this.dryNode["gain"], 1 - value, ramp, time);
				break;
		}
	};

	function CompressorEffect(threshold, knee, ratio, attack, release) {
		this.type = "compressor";
		this.params = [threshold, knee, ratio, attack, release];
		this.node = context["createDynamicsCompressor"]();
		try {
			this.node["threshold"]["value"] = threshold;
			this.node["knee"]["value"] = knee;
			this.node["ratio"]["value"] = ratio;
			this.node["attack"]["value"] = attack;
			this.node["release"]["value"] = release;
		}
		catch (e) {
		}
	};
	CompressorEffect.prototype.connectTo = function (node_) {
		this.node["disconnect"]();
		this.node["connect"](node_);
	};
	CompressorEffect.prototype.remove = function () {
		this.node["disconnect"]();
	};
	CompressorEffect.prototype.getInputNode = function () {
		return this.node;
	};
	CompressorEffect.prototype.setParam = function (param, value, ramp, time) {
	};

	function AnalyserEffect(fftSize, smoothing) {
		this.type = "analyser";
		this.params = [fftSize, smoothing];
		this.node = context["createAnalyser"]();
		this.node["fftSize"] = fftSize;
		this.node["smoothingTimeConstant"] = smoothing;
		this.freqBins = new Float32Array(this.node["frequencyBinCount"]);
		this.signal = new Uint8Array(fftSize);
		this.peak = 0;
		this.rms = 0;
	};
	AnalyserEffect.prototype.tick = function () {
		this.node["getFloatFrequencyData"](this.freqBins);
		this.node["getByteTimeDomainData"](this.signal);
		var fftSize = this.node["fftSize"];
		var i = 0;
		this.peak = 0;
		var rmsSquaredSum = 0;
		var s = 0;
		for (; i < fftSize; i++) {
			s = (this.signal[i] - 128) / 128;
			if (s < 0)
				s = -s;
			if (this.peak < s)
				this.peak = s;
			rmsSquaredSum += s * s;
		}
		this.peak = linearToDb(this.peak);
		this.rms = linearToDb(Math.sqrt(rmsSquaredSum / fftSize));
	};
	AnalyserEffect.prototype.connectTo = function (node_) {
		this.node["disconnect"]();
		this.node["connect"](node_);
	};
	AnalyserEffect.prototype.remove = function () {
		this.node["disconnect"]();
	};
	AnalyserEffect.prototype.getInputNode = function () {
		return this.node;
	};
	AnalyserEffect.prototype.setParam = function (param, value, ramp, time) {
	};

	function ObjectTracker() {
		this.obj = null;
		this.loadUid = 0;
	};
	ObjectTracker.prototype.setObject = function (obj_) {
		this.obj = obj_;
	};
	ObjectTracker.prototype.hasObject = function () {
		return !!this.obj;
	};
	ObjectTracker.prototype.tick = function (dt) {
	};
	var iOShadtouchstart = false;	// has had touch start input on iOS <=8 to work around web audio API muting
	var iOShadtouchend = false;		// has had touch end input on iOS 9+ to work around web audio API muting
	function C2AudioBuffer(src_, is_music) {
		this.src = src_;
		this.myapi = api;
		this.is_music = is_music;
		this.added_end_listener = false;
		var self = this;
		this.outNode = null;
		this.mediaSourceNode = null;
		this.panWhenReady = [];		// for web audio API positioned sounds
		this.seekWhenReady = 0;
		this.pauseWhenReady = false;
		this.supportWebAudioAPI = false;
		this.failedToLoad = false;
		this.wasEverReady = false;	// if a buffer is ever marked as ready, it's permanently considered ready after then.
		if (api === API_WEBAUDIO && is_music && !playMusicAsSoundWorkaround) {
			this.myapi = API_HTML5;
			this.outNode = createGain();
		}
		this.bufferObject = null;			// actual audio object
		this.audioData = null;				// web audio api: ajax request result (compressed audio that needs decoding)
		var request;
		switch (this.myapi) {
			case API_HTML5:
				this.bufferObject = new Audio();
				this.bufferObject.crossOrigin = "anonymous";
				this.bufferObject.addEventListener("canplaythrough", function () {
					self.wasEverReady = true;	// update loaded state so preload is considered complete
				});
				if (api === API_WEBAUDIO && context["createMediaElementSource"] && !/wiiu/i.test(navigator.userAgent)) {
					this.supportWebAudioAPI = true;		// can be routed through web audio api
					this.bufferObject.addEventListener("canplay", function () {
						if (!self.mediaSourceNode)		// protect against this event firing twice
						{
							self.mediaSourceNode = context["createMediaElementSource"](self.bufferObject);
							self.mediaSourceNode["connect"](self.outNode);
						}
					});
				}
				this.bufferObject.autoplay = false;	// this is only a source buffer, not an instance
				this.bufferObject.preload = "auto";
				this.bufferObject.src = src_;
				break;
			case API_WEBAUDIO:
				if (audRuntime.isWKWebView) {
					audRuntime.fetchLocalFileViaCordovaAsArrayBuffer(src_, function (arrayBuffer) {
						self.audioData = arrayBuffer;
						self.decodeAudioBuffer();
					}, function (err) {
						self.failedToLoad = true;
					});
				}
				else {
					request = new XMLHttpRequest();
					request.open("GET", src_, true);
					request.responseType = "arraybuffer";
					request.onload = function () {
						self.audioData = request.response;
						self.decodeAudioBuffer();
					};
					request.onerror = function () {
						self.failedToLoad = true;
					};
					request.send();
				}
				break;
			case API_CORDOVA:
				this.bufferObject = true;
				break;
			case API_APPMOBI:
				this.bufferObject = true;
				break;
		}
	};
	C2AudioBuffer.prototype.release = function () {
		var i, len, j, a;
		for (i = 0, j = 0, len = audioInstances.length; i < len; ++i) {
			a = audioInstances[i];
			audioInstances[j] = a;
			if (a.buffer === this)
				a.stop();
			else
				++j;		// keep
		}
		audioInstances.length = j;
		this.bufferObject = null;
		this.audioData = null;
	};
	C2AudioBuffer.prototype.decodeAudioBuffer = function () {
		if (this.bufferObject || !this.audioData)
			return;		// audio already decoded or AJAX request not yet complete
		var self = this;
		if (context["decodeAudioData"]) {
			context["decodeAudioData"](this.audioData, function (buffer) {
				self.bufferObject = buffer;
				self.audioData = null;		// clear AJAX response to allow GC and save memory, only need the bufferObject now
				var p, i, len, a;
				if (!cr.is_undefined(self.playTagWhenReady) && !silent) {
					if (self.panWhenReady.length) {
						for (i = 0, len = self.panWhenReady.length; i < len; i++) {
							p = self.panWhenReady[i];
							a = new C2AudioInstance(self, p.thistag);
							a.setPannerEnabled(true);
							if (typeof p.objUid !== "undefined") {
								p.obj = audRuntime.getObjectByUID(p.objUid);
								if (!p.obj)
									continue;
							}
							if (p.obj) {
								var px = cr.rotatePtAround(p.obj.x, p.obj.y, -p.obj.layer.getAngle(), listenerX, listenerY, true);
								var py = cr.rotatePtAround(p.obj.x, p.obj.y, -p.obj.layer.getAngle(), listenerX, listenerY, false);
								a.setPan(px, py, cr.to_degrees(p.obj.angle - p.obj.layer.getAngle()), p.ia, p.oa, p.og);
								a.setObject(p.obj);
							}
							else {
								a.setPan(p.x, p.y, p.a, p.ia, p.oa, p.og);
							}
							a.play(self.loopWhenReady, self.volumeWhenReady, self.seekWhenReady);
							if (self.pauseWhenReady)
								a.pause();
							audioInstances.push(a);
						}
						cr.clearArray(self.panWhenReady);
					}
					else {
						a = new C2AudioInstance(self, self.playTagWhenReady || "");		// sometimes playTagWhenReady is not set - TODO: why?
						a.play(self.loopWhenReady, self.volumeWhenReady, self.seekWhenReady);
						if (self.pauseWhenReady)
							a.pause();
						audioInstances.push(a);
					}
				}
				else if (!cr.is_undefined(self.convolveWhenReady)) {
					var convolveNode = self.convolveWhenReady.convolveNode;
					convolveNode["normalize"] = self.normalizeWhenReady;
					convolveNode["buffer"] = buffer;
				}
			}, function (e) {
				self.failedToLoad = true;
			});
		}
		else {
			this.bufferObject = context["createBuffer"](this.audioData, false);
			this.audioData = null;		// clear AJAX response to allow GC and save memory, only need the bufferObject now
			if (!cr.is_undefined(this.playTagWhenReady) && !silent) {
				var a = new C2AudioInstance(this, this.playTagWhenReady);
				a.play(this.loopWhenReady, this.volumeWhenReady, this.seekWhenReady);
				if (this.pauseWhenReady)
					a.pause();
				audioInstances.push(a);
			}
			else if (!cr.is_undefined(this.convolveWhenReady)) {
				var convolveNode = this.convolveWhenReady.convolveNode;
				convolveNode["normalize"] = this.normalizeWhenReady;
				convolveNode["buffer"] = this.bufferObject;
			}
		}
	};
	C2AudioBuffer.prototype.isLoaded = function () {
		switch (this.myapi) {
			case API_HTML5:
				var ret = this.bufferObject["readyState"] >= 4;	// HAVE_ENOUGH_DATA
				if (ret)
					this.wasEverReady = true;
				return ret || this.wasEverReady;
			case API_WEBAUDIO:
				return !!this.audioData || !!this.bufferObject;
			case API_CORDOVA:
				return true;
			case API_APPMOBI:
				return true;
		}
		return false;
	};
	C2AudioBuffer.prototype.isLoadedAndDecoded = function () {
		switch (this.myapi) {
			case API_HTML5:
				return this.isLoaded();		// no distinction between loaded and decoded in HTML5 audio, just rely on ready state
			case API_WEBAUDIO:
				return !!this.bufferObject;
			case API_CORDOVA:
				return true;
			case API_APPMOBI:
				return true;
		}
		return false;
	};
	C2AudioBuffer.prototype.hasFailedToLoad = function () {
		switch (this.myapi) {
			case API_HTML5:
				return !!this.bufferObject["error"];
			case API_WEBAUDIO:
				return this.failedToLoad;
		}
		return false;
	};

	function C2AudioInstance(buffer_, tag_) {
		var self = this;
		this.tag = tag_;
		this.fresh = true;
		this.stopped = true;
		this.src = buffer_.src;
		this.buffer = buffer_;
		this.myapi = api;
		this.is_music = buffer_.is_music;
		this.playbackRate = 1;
		this.hasPlaybackEnded = true;	// ended flag
		this.resume_me = false;			// make sure resumes when leaving suspend
		this.is_paused = false;
		this.resume_position = 0;		// for web audio api to resume from correct playback position
		this.looping = false;
		this.is_muted = false;
		this.is_silent = false;
		this.volume = 1;
		this.onended_handler = function (e) {
			if (self.is_paused || self.resume_me)
				return;
			var bufferThatEnded = this;
			if (!bufferThatEnded)
				bufferThatEnded = e.target;
			if (bufferThatEnded !== self.active_buffer)
				return;
			self.hasPlaybackEnded = true;
			self.stopped = true;
			audTag = self.tag;
			audRuntime.trigger(cr.plugins_.Audio.prototype.cnds.OnEnded, audInst);
		};
		this.active_buffer = null;
		this.isTimescaled = ((timescale_mode === 1 && !this.is_music) || timescale_mode === 2);
		this.mutevol = 1;
		this.startTime = (this.isTimescaled ? audRuntime.kahanTime.sum : audRuntime.wallTime.sum);
		this.gainNode = null;
		this.pannerNode = null;
		this.pannerEnabled = false;
		this.objectTracker = null;
		this.panX = 0;
		this.panY = 0;
		this.panAngle = 0;
		this.panConeInner = 0;
		this.panConeOuter = 0;
		this.panConeOuterGain = 0;
		this.instanceObject = null;
		var add_end_listener = false;
		if (this.myapi === API_WEBAUDIO && this.buffer.myapi === API_HTML5 && !this.buffer.supportWebAudioAPI)
			this.myapi = API_HTML5;
		switch (this.myapi) {
			case API_HTML5:
				if (this.is_music) {
					this.instanceObject = buffer_.bufferObject;
					add_end_listener = !buffer_.added_end_listener;
					buffer_.added_end_listener = true;
				}
				else {
					this.instanceObject = new Audio();
					this.instanceObject.crossOrigin = "anonymous";
					this.instanceObject.autoplay = false;
					this.instanceObject.src = buffer_.bufferObject.src;
					add_end_listener = true;
				}
				if (add_end_listener) {
					this.instanceObject.addEventListener('ended', function () {
						audTag = self.tag;
						self.stopped = true;
						audRuntime.trigger(cr.plugins_.Audio.prototype.cnds.OnEnded, audInst);
					});
				}
				break;
			case API_WEBAUDIO:
				this.gainNode = createGain();
				this.gainNode["connect"](getDestinationForTag(tag_));
				if (this.buffer.myapi === API_WEBAUDIO) {
					if (buffer_.bufferObject) {
						this.instanceObject = context["createBufferSource"]();
						this.instanceObject["buffer"] = buffer_.bufferObject;
						this.instanceObject["connect"](this.gainNode);
					}
				}
				else {
					this.instanceObject = this.buffer.bufferObject;		// reference the audio element
					this.buffer.outNode["connect"](this.gainNode);
					if (!this.buffer.added_end_listener) {
						this.buffer.added_end_listener = true;
						this.buffer.bufferObject.addEventListener('ended', function () {
							audTag = self.tag;
							self.stopped = true;
							audRuntime.trigger(cr.plugins_.Audio.prototype.cnds.OnEnded, audInst);
						});
					}
				}
				break;
			case API_CORDOVA:
				this.instanceObject = new window["Media"](appPath + this.src, null, null, function (status) {
					if (status === window["Media"]["MEDIA_STOPPED"]) {
						self.hasPlaybackEnded = true;
						self.stopped = true;
						audTag = self.tag;
						audRuntime.trigger(cr.plugins_.Audio.prototype.cnds.OnEnded, audInst);
					}
				});
				break;
			case API_APPMOBI:
				this.instanceObject = true;
				break;
		}
	};
	C2AudioInstance.prototype.hasEnded = function () {
		var time;
		switch (this.myapi) {
			case API_HTML5:
				return this.instanceObject.ended;
			case API_WEBAUDIO:
				if (this.buffer.myapi === API_WEBAUDIO) {
					if (!this.fresh && !this.stopped && this.instanceObject["loop"])
						return false;
					if (this.is_paused)
						return false;
					return this.hasPlaybackEnded;
				}
				else
					return this.instanceObject.ended;
			case API_CORDOVA:
				return this.hasPlaybackEnded;
			case API_APPMOBI:
				true;	// recycling an AppMobi sound does not matter because it will just do another throwaway playSound
		}
		return true;
	};
	C2AudioInstance.prototype.canBeRecycled = function () {
		if (this.fresh || this.stopped)
			return true;		// not yet used or is not playing
		return this.hasEnded();
	};
	C2AudioInstance.prototype.setPannerEnabled = function (enable_) {
		if (api !== API_WEBAUDIO)
			return;
		if (!this.pannerEnabled && enable_) {
			if (!this.gainNode)
				return;
			if (!this.pannerNode) {
				this.pannerNode = context["createPanner"]();
				if (typeof this.pannerNode["panningModel"] === "number")
					this.pannerNode["panningModel"] = panningModel;
				else
					this.pannerNode["panningModel"] = ["equalpower", "HRTF", "soundfield"][panningModel];
				if (typeof this.pannerNode["distanceModel"] === "number")
					this.pannerNode["distanceModel"] = distanceModel;
				else
					this.pannerNode["distanceModel"] = ["linear", "inverse", "exponential"][distanceModel];
				this.pannerNode["refDistance"] = refDistance;
				this.pannerNode["maxDistance"] = maxDistance;
				this.pannerNode["rolloffFactor"] = rolloffFactor;
			}
			this.gainNode["disconnect"]();
			this.gainNode["connect"](this.pannerNode);
			this.pannerNode["connect"](getDestinationForTag(this.tag));
			this.pannerEnabled = true;
		}
		else if (this.pannerEnabled && !enable_) {
			if (!this.gainNode)
				return;
			this.pannerNode["disconnect"]();
			this.gainNode["disconnect"]();
			this.gainNode["connect"](getDestinationForTag(this.tag));
			this.pannerEnabled = false;
		}
	};
	C2AudioInstance.prototype.setPan = function (x, y, angle, innerangle, outerangle, outergain) {
		if (!this.pannerEnabled || api !== API_WEBAUDIO)
			return;
		this.pannerNode["setPosition"](x, y, 0);
		this.pannerNode["setOrientation"](Math.cos(cr.to_radians(angle)), Math.sin(cr.to_radians(angle)), 0);
		this.pannerNode["coneInnerAngle"] = innerangle;
		this.pannerNode["coneOuterAngle"] = outerangle;
		this.pannerNode["coneOuterGain"] = outergain;
		this.panX = x;
		this.panY = y;
		this.panAngle = angle;
		this.panConeInner = innerangle;
		this.panConeOuter = outerangle;
		this.panConeOuterGain = outergain;
	};
	C2AudioInstance.prototype.setObject = function (o) {
		if (!this.pannerEnabled || api !== API_WEBAUDIO)
			return;
		if (!this.objectTracker)
			this.objectTracker = new ObjectTracker();
		this.objectTracker.setObject(o);
	};
	C2AudioInstance.prototype.tick = function (dt) {
		if (!this.pannerEnabled || api !== API_WEBAUDIO || !this.objectTracker || !this.objectTracker.hasObject() || !this.isPlaying()) {
			return;
		}
		this.objectTracker.tick(dt);
		var inst = this.objectTracker.obj;
		var px = cr.rotatePtAround(inst.x, inst.y, -inst.layer.getAngle(), listenerX, listenerY, true);
		var py = cr.rotatePtAround(inst.x, inst.y, -inst.layer.getAngle(), listenerX, listenerY, false);
		this.pannerNode["setPosition"](px, py, 0);
		var a = 0;
		if (typeof this.objectTracker.obj.angle !== "undefined") {
			a = inst.angle - inst.layer.getAngle();
			this.pannerNode["setOrientation"](Math.cos(a), Math.sin(a), 0);
		}
	};
	C2AudioInstance.prototype.play = function (looping, vol, fromPosition, scheduledTime) {
		var instobj = this.instanceObject;
		this.looping = looping;
		this.volume = vol;
		var seekPos = fromPosition || 0;
		scheduledTime = scheduledTime || 0;
		switch (this.myapi) {
			case API_HTML5:
				if (instobj.playbackRate !== 1.0)
					instobj.playbackRate = 1.0;
				if (instobj.volume !== vol * masterVolume)
					instobj.volume = vol * masterVolume;
				if (instobj.loop !== looping)
					instobj.loop = looping;
				if (instobj.muted)
					instobj.muted = false;
				if (instobj.currentTime !== seekPos) {
					try {
						instobj.currentTime = seekPos;
					}
					catch (err) {
						;
					}
				}
				if (this.is_music && isMusicWorkaround && !audRuntime.isInUserInputEvent)
					musicPlayNextTouch.push(this);
				else {
					try {
						this.instanceObject.play();
					}
					catch (e) {		// sometimes throws on WP8.1... try not to kill the app
						if (console && console.log)
							console.log("[C2] WARNING: exception trying to play audio '" + this.buffer.src + "': ", e);
					}
				}
				break;
			case API_WEBAUDIO:
				this.muted = false;
				this.mutevol = 1;
				if (this.buffer.myapi === API_WEBAUDIO) {
					this.gainNode["gain"]["value"] = vol * masterVolume;
					if (!this.fresh) {
						this.instanceObject = context["createBufferSource"]();
						this.instanceObject["buffer"] = this.buffer.bufferObject;
						this.instanceObject["connect"](this.gainNode);
					}
					this.instanceObject["onended"] = this.onended_handler;
					this.active_buffer = this.instanceObject;
					this.instanceObject.loop = looping;
					this.hasPlaybackEnded = false;
					if (seekPos === 0)
						startSource(this.instanceObject, scheduledTime);
					else
						startSourceAt(this.instanceObject, seekPos, this.getDuration(), scheduledTime);
				}
				else {
					if (instobj.playbackRate !== 1.0)
						instobj.playbackRate = 1.0;
					if (instobj.loop !== looping)
						instobj.loop = looping;
					instobj.volume = vol * masterVolume;
					if (instobj.currentTime !== seekPos) {
						try {
							instobj.currentTime = seekPos;
						}
						catch (err) {
							;
						}
					}
					if (this.is_music && isMusicWorkaround && !audRuntime.isInUserInputEvent)
						musicPlayNextTouch.push(this);
					else
						instobj.play();
				}
				break;
			case API_CORDOVA:
				if ((!this.fresh && this.stopped) || seekPos !== 0)
					instobj["seekTo"](seekPos);
				instobj["play"]();
				this.hasPlaybackEnded = false;
				break;
			case API_APPMOBI:
				if (audRuntime.isDirectCanvas)
					AppMobi["context"]["playSound"](this.src, looping);
				else
					AppMobi["player"]["playSound"](this.src, looping);
				break;
		}
		this.playbackRate = 1;
		this.startTime = (this.isTimescaled ? audRuntime.kahanTime.sum : audRuntime.wallTime.sum) - seekPos;
		this.fresh = false;
		this.stopped = false;
		this.is_paused = false;
	};
	C2AudioInstance.prototype.stop = function () {
		switch (this.myapi) {
			case API_HTML5:
				if (!this.instanceObject.paused)
					this.instanceObject.pause();
				break;
			case API_WEBAUDIO:
				if (this.buffer.myapi === API_WEBAUDIO)
					stopSource(this.instanceObject);
				else {
					if (!this.instanceObject.paused)
						this.instanceObject.pause();
				}
				break;
			case API_CORDOVA:
				this.instanceObject["stop"]();
				break;
			case API_APPMOBI:
				if (audRuntime.isDirectCanvas)
					AppMobi["context"]["stopSound"](this.src);
				break;
		}
		this.stopped = true;
		this.is_paused = false;
	};
	C2AudioInstance.prototype.pause = function () {
		if (this.fresh || this.stopped || this.hasEnded() || this.is_paused)
			return;
		switch (this.myapi) {
			case API_HTML5:
				if (!this.instanceObject.paused)
					this.instanceObject.pause();
				break;
			case API_WEBAUDIO:
				if (this.buffer.myapi === API_WEBAUDIO) {
					this.resume_position = this.getPlaybackTime(true);
					if (this.looping)
						this.resume_position = this.resume_position % this.getDuration();
					this.is_paused = true;
					stopSource(this.instanceObject);
				}
				else {
					if (!this.instanceObject.paused)
						this.instanceObject.pause();
				}
				break;
			case API_CORDOVA:
				this.instanceObject["pause"]();
				break;
			case API_APPMOBI:
				if (audRuntime.isDirectCanvas)
					AppMobi["context"]["stopSound"](this.src);
				break;
		}
		this.is_paused = true;
	};
	C2AudioInstance.prototype.resume = function () {
		if (this.fresh || this.stopped || this.hasEnded() || !this.is_paused)
			return;
		switch (this.myapi) {
			case API_HTML5:
				this.instanceObject.play();
				break;
			case API_WEBAUDIO:
				if (this.buffer.myapi === API_WEBAUDIO) {
					this.instanceObject = context["createBufferSource"]();
					this.instanceObject["buffer"] = this.buffer.bufferObject;
					this.instanceObject["connect"](this.gainNode);
					this.instanceObject["onended"] = this.onended_handler;
					this.active_buffer = this.instanceObject;
					this.instanceObject.loop = this.looping;
					this.gainNode["gain"]["value"] = masterVolume * this.volume * this.mutevol;
					this.updatePlaybackRate();
					this.startTime = (this.isTimescaled ? audRuntime.kahanTime.sum : audRuntime.wallTime.sum) - (this.resume_position / (this.playbackRate || 0.001));
					startSourceAt(this.instanceObject, this.resume_position, this.getDuration());
				}
				else {
					this.instanceObject.play();
				}
				break;
			case API_CORDOVA:
				this.instanceObject["play"]();
				break;
			case API_APPMOBI:
				if (audRuntime.isDirectCanvas)
					AppMobi["context"]["resumeSound"](this.src);
				break;
		}
		this.is_paused = false;
	};
	C2AudioInstance.prototype.seek = function (pos) {
		if (this.fresh || this.stopped || this.hasEnded())
			return;
		switch (this.myapi) {
			case API_HTML5:
				try {
					this.instanceObject.currentTime = pos;
				}
				catch (e) {
				}
				break;
			case API_WEBAUDIO:
				if (this.buffer.myapi === API_WEBAUDIO) {
					if (this.is_paused)
						this.resume_position = pos;
					else {
						this.pause();
						this.resume_position = pos;
						this.resume();
					}
				}
				else {
					try {
						this.instanceObject.currentTime = pos;
					}
					catch (e) {
					}
				}
				break;
			case API_CORDOVA:
				break;
			case API_APPMOBI:
				if (audRuntime.isDirectCanvas)
					AppMobi["context"]["seekSound"](this.src, pos);
				break;
		}
	};
	C2AudioInstance.prototype.reconnect = function (toNode) {
		if (this.myapi !== API_WEBAUDIO)
			return;
		if (this.pannerEnabled) {
			this.pannerNode["disconnect"]();
			this.pannerNode["connect"](toNode);
		}
		else {
			this.gainNode["disconnect"]();
			this.gainNode["connect"](toNode);
		}
	};
	C2AudioInstance.prototype.getDuration = function (applyPlaybackRate) {
		var ret = 0;
		switch (this.myapi) {
			case API_HTML5:
				if (typeof this.instanceObject.duration !== "undefined")
					ret = this.instanceObject.duration;
				break;
			case API_WEBAUDIO:
				ret = this.buffer.bufferObject["duration"];
				break;
			case API_CORDOVA:
				ret = this.instanceObject["getDuration"]();
				break;
			case API_APPMOBI:
				if (audRuntime.isDirectCanvas)
					ret = AppMobi["context"]["getDurationSound"](this.src);
				break;
		}
		if (applyPlaybackRate)
			ret /= (this.playbackRate || 0.001);		// avoid divide-by-zero
		return ret;
	};
	C2AudioInstance.prototype.getPlaybackTime = function (applyPlaybackRate) {
		var duration = this.getDuration();
		var ret = 0;
		switch (this.myapi) {
			case API_HTML5:
				if (typeof this.instanceObject.currentTime !== "undefined")
					ret = this.instanceObject.currentTime;
				break;
			case API_WEBAUDIO:
				if (this.buffer.myapi === API_WEBAUDIO) {
					if (this.is_paused)
						return this.resume_position;
					else
						ret = (this.isTimescaled ? audRuntime.kahanTime.sum : audRuntime.wallTime.sum) - this.startTime;
				}
				else if (typeof this.instanceObject.currentTime !== "undefined")
					ret = this.instanceObject.currentTime;
				break;
			case API_CORDOVA:
				break;
			case API_APPMOBI:
				if (audRuntime.isDirectCanvas)
					ret = AppMobi["context"]["getPlaybackTimeSound"](this.src);
				break;
		}
		if (applyPlaybackRate)
			ret *= this.playbackRate;
		if (!this.looping && ret > duration)
			ret = duration;
		return ret;
	};
	C2AudioInstance.prototype.isPlaying = function () {
		return !this.is_paused && !this.fresh && !this.stopped && !this.hasEnded();
	};
	C2AudioInstance.prototype.shouldSave = function () {
		return !this.fresh && !this.stopped && !this.hasEnded();
	};
	C2AudioInstance.prototype.setVolume = function (v) {
		this.volume = v;
		this.updateVolume();
	};
	C2AudioInstance.prototype.updateVolume = function () {
		var volToSet = this.volume * masterVolume;
		if (!isFinite(volToSet))
			volToSet = 0;		// HTMLMediaElement throws if setting non-finite volume
		switch (this.myapi) {
			case API_HTML5:
				if (typeof this.instanceObject.volume !== "undefined" && this.instanceObject.volume !== volToSet)
					this.instanceObject.volume = volToSet;
				break;
			case API_WEBAUDIO:
				if (this.buffer.myapi === API_WEBAUDIO) {
					this.gainNode["gain"]["value"] = volToSet * this.mutevol;
				}
				else {
					if (typeof this.instanceObject.volume !== "undefined" && this.instanceObject.volume !== volToSet)
						this.instanceObject.volume = volToSet;
				}
				break;
			case API_CORDOVA:
				break;
			case API_APPMOBI:
				break;
		}
	};
	C2AudioInstance.prototype.getVolume = function () {
		return this.volume;
	};
	C2AudioInstance.prototype.doSetMuted = function (m) {
		switch (this.myapi) {
			case API_HTML5:
				if (this.instanceObject.muted !== !!m)
					this.instanceObject.muted = !!m;
				break;
			case API_WEBAUDIO:
				if (this.buffer.myapi === API_WEBAUDIO) {
					this.mutevol = (m ? 0 : 1);
					this.gainNode["gain"]["value"] = masterVolume * this.volume * this.mutevol;
				}
				else {
					if (this.instanceObject.muted !== !!m)
						this.instanceObject.muted = !!m;
				}
				break;
			case API_CORDOVA:
				break;
			case API_APPMOBI:
				break;
		}
	};
	C2AudioInstance.prototype.setMuted = function (m) {
		this.is_muted = !!m;
		this.doSetMuted(this.is_muted || this.is_silent);
	};
	C2AudioInstance.prototype.setSilent = function (m) {
		this.is_silent = !!m;
		this.doSetMuted(this.is_muted || this.is_silent);
	};
	C2AudioInstance.prototype.setLooping = function (l) {
		this.looping = l;
		switch (this.myapi) {
			case API_HTML5:
				if (this.instanceObject.loop !== !!l)
					this.instanceObject.loop = !!l;
				break;
			case API_WEBAUDIO:
				if (this.instanceObject.loop !== !!l)
					this.instanceObject.loop = !!l;
				break;
			case API_CORDOVA:
				break;
			case API_APPMOBI:
				if (audRuntime.isDirectCanvas)
					AppMobi["context"]["setLoopingSound"](this.src, l);
				break;
		}
	};
	C2AudioInstance.prototype.setPlaybackRate = function (r) {
		this.playbackRate = r;
		this.updatePlaybackRate();
	};
	C2AudioInstance.prototype.updatePlaybackRate = function () {
		var r = this.playbackRate;
		if (this.isTimescaled)
			r *= audRuntime.timescale;
		switch (this.myapi) {
			case API_HTML5:
				if (this.instanceObject.playbackRate !== r)
					this.instanceObject.playbackRate = r;
				break;
			case API_WEBAUDIO:
				if (this.buffer.myapi === API_WEBAUDIO) {
					if (this.instanceObject["playbackRate"]["value"] !== r)
						this.instanceObject["playbackRate"]["value"] = r;
				}
				else {
					if (this.instanceObject.playbackRate !== r)
						this.instanceObject.playbackRate = r;
				}
				break;
			case API_CORDOVA:
				break;
			case API_APPMOBI:
				break;
		}
	};
	C2AudioInstance.prototype.setSuspended = function (s) {
		switch (this.myapi) {
			case API_HTML5:
				if (s) {
					if (this.isPlaying()) {
						this.resume_me = true;
						this.instanceObject["pause"]();
					}
					else
						this.resume_me = false;
				}
				else {
					if (this.resume_me) {
						this.instanceObject["play"]();
						this.resume_me = false;
					}
				}
				break;
			case API_WEBAUDIO:
				if (s) {
					if (this.isPlaying()) {
						this.resume_me = true;
						if (this.buffer.myapi === API_WEBAUDIO) {
							this.resume_position = this.getPlaybackTime(true);
							if (this.looping)
								this.resume_position = this.resume_position % this.getDuration();
							stopSource(this.instanceObject);
						}
						else
							this.instanceObject["pause"]();
					}
					else
						this.resume_me = false;
				}
				else {
					if (this.resume_me) {
						if (this.buffer.myapi === API_WEBAUDIO) {
							this.instanceObject = context["createBufferSource"]();
							this.instanceObject["buffer"] = this.buffer.bufferObject;
							this.instanceObject["connect"](this.gainNode);
							this.instanceObject["onended"] = this.onended_handler;
							this.active_buffer = this.instanceObject;
							this.instanceObject.loop = this.looping;
							this.gainNode["gain"]["value"] = masterVolume * this.volume * this.mutevol;
							this.updatePlaybackRate();
							this.startTime = (this.isTimescaled ? audRuntime.kahanTime.sum : audRuntime.wallTime.sum) - (this.resume_position / (this.playbackRate || 0.001));
							startSourceAt(this.instanceObject, this.resume_position, this.getDuration());
						}
						else {
							this.instanceObject["play"]();
						}
						this.resume_me = false;
					}
				}
				break;
			case API_CORDOVA:
				if (s) {
					if (this.isPlaying()) {
						this.instanceObject["pause"]();
						this.resume_me = true;
					}
					else
						this.resume_me = false;
				}
				else {
					if (this.resume_me) {
						this.resume_me = false;
						this.instanceObject["play"]();
					}
				}
				break;
			case API_APPMOBI:
				break;
		}
	};
	pluginProto.Instance = function (type) {
		this.type = type;
		this.runtime = type.runtime;
		audRuntime = this.runtime;
		audInst = this;
		this.listenerTracker = null;
		this.listenerZ = -600;
		if (this.runtime.isWKWebView)
			playMusicAsSoundWorkaround = true;
		if ((this.runtime.isiOS || (this.runtime.isAndroid && (this.runtime.isChrome || this.runtime.isAndroidStockBrowser))) && !this.runtime.isCrosswalk && !this.runtime.isDomFree && !this.runtime.isAmazonWebApp && !playMusicAsSoundWorkaround) {
			isMusicWorkaround = true;
		}
		context = null;
		if (typeof AudioContext !== "undefined") {
			api = API_WEBAUDIO;
			context = new AudioContext();
		}
		else if (typeof webkitAudioContext !== "undefined") {
			api = API_WEBAUDIO;
			context = new webkitAudioContext();
		}
		if (this.runtime.isiOS && context) {
			if (context.close)
				context.close();
			if (typeof AudioContext !== "undefined")
				context = new AudioContext();
			else if (typeof webkitAudioContext !== "undefined")
				context = new webkitAudioContext();
		}
		var playDummyBuffer = function () {
			if (isContextSuspended || !context["createBuffer"])
				return;
			var buffer = context["createBuffer"](1, 220, 22050);
			var source = context["createBufferSource"]();
			source["buffer"] = buffer;
			source["connect"](context["destination"]);
			startSource(source);
		};
		if (isMusicWorkaround) {
			var playQueuedMusic = function () {
				var i, len, m;
				if (isMusicWorkaround) {
					if (!silent) {
						for (i = 0, len = musicPlayNextTouch.length; i < len; ++i) {
							m = musicPlayNextTouch[i];
							if (!m.stopped && !m.is_paused)
								m.instanceObject.play();
						}
					}
					cr.clearArray(musicPlayNextTouch);
				}
			};
			document.addEventListener("touchend", function () {
				if (!iOShadtouchend && context) {
					playDummyBuffer();
					iOShadtouchend = true;
				}
				playQueuedMusic();
			}, true);
		}
		else if (playMusicAsSoundWorkaround) {
			document.addEventListener("touchend", function () {
				if (!iOShadtouchend && context) {
					playDummyBuffer();
					iOShadtouchend = true;
				}
			}, true);
		}
		if (api !== API_WEBAUDIO) {
			if (this.runtime.isCordova && typeof window["Media"] !== "undefined")
				api = API_CORDOVA;
			else if (this.runtime.isAppMobi)
				api = API_APPMOBI;
		}
		if (api === API_CORDOVA) {
			appPath = location.href;
			var i = appPath.lastIndexOf("/");
			if (i > -1)
				appPath = appPath.substr(0, i + 1);
			appPath = appPath.replace("file://", "");
		}
		if (this.runtime.isSafari && this.runtime.isWindows && typeof Audio === "undefined") {
			alert("It looks like you're using Safari for Windows without Quicktime.  Audio cannot be played until Quicktime is installed.");
			this.runtime.DestroyInstance(this);
		}
		else {
			if (this.runtime.isDirectCanvas)
				useOgg = this.runtime.isAndroid;		// AAC on iOS, OGG on Android
			else {
				try {
					useOgg = !!(new Audio().canPlayType('audio/ogg; codecs="vorbis"'));
				}
				catch (e) {
					useOgg = false;
				}
			}
			switch (api) {
				case API_HTML5:
					;
					break;
				case API_WEBAUDIO:
					;
					break;
				case API_CORDOVA:
					;
					break;
				case API_APPMOBI:
					;
					break;
				default:
					;
			}
			this.runtime.tickMe(this);
		}
	};
	var instanceProto = pluginProto.Instance.prototype;
	instanceProto.onCreate = function () {
		this.runtime.audioInstance = this;
		timescale_mode = this.properties[0];	// 0 = off, 1 = sounds only, 2 = all
		this.saveload = this.properties[1];		// 0 = all, 1 = sounds only, 2 = music only, 3 = none
		this.playinbackground = (this.properties[2] !== 0);
		this.nextPlayTime = 0;
		panningModel = this.properties[3];		// 0 = equalpower, 1 = hrtf, 3 = soundfield
		distanceModel = this.properties[4];		// 0 = linear, 1 = inverse, 2 = exponential
		this.listenerZ = -this.properties[5];
		refDistance = this.properties[6];
		maxDistance = this.properties[7];
		rolloffFactor = this.properties[8];
		this.listenerTracker = new ObjectTracker();
		var draw_width = (this.runtime.draw_width || this.runtime.width);
		var draw_height = (this.runtime.draw_height || this.runtime.height);
		if (api === API_WEBAUDIO) {
			context["listener"]["setPosition"](draw_width / 2, draw_height / 2, this.listenerZ);
			context["listener"]["setOrientation"](0, 0, 1, 0, -1, 0);
			window["c2OnAudioMicStream"] = function (localMediaStream, tag) {
				if (micSource)
					micSource["disconnect"]();
				micTag = tag.toLowerCase();
				micSource = context["createMediaStreamSource"](localMediaStream);
				micSource["connect"](getDestinationForTag(micTag));
			};
		}
		this.runtime.addSuspendCallback(function (s) {
			audInst.onSuspend(s);
		});
		var self = this;
		this.runtime.addDestroyCallback(function (inst) {
			self.onInstanceDestroyed(inst);
		});
	};
	instanceProto.onInstanceDestroyed = function (inst) {
		var i, len, a;
		for (i = 0, len = audioInstances.length; i < len; i++) {
			a = audioInstances[i];
			if (a.objectTracker) {
				if (a.objectTracker.obj === inst) {
					a.objectTracker.obj = null;
					if (a.pannerEnabled && a.isPlaying() && a.looping)
						a.stop();
				}
			}
		}
		if (this.listenerTracker.obj === inst)
			this.listenerTracker.obj = null;
	};
	instanceProto.saveToJSON = function () {
		var o = {
			"silent": silent,
			"masterVolume": masterVolume,
			"listenerZ": this.listenerZ,
			"listenerUid": this.listenerTracker.hasObject() ? this.listenerTracker.obj.uid : -1,
			"playing": [],
			"effects": {}
		};
		var playingarr = o["playing"];
		var i, len, a, d, p, panobj, playbackTime;
		for (i = 0, len = audioInstances.length; i < len; i++) {
			a = audioInstances[i];
			if (!a.shouldSave())
				continue;				// no need to save stopped sounds
			if (this.saveload === 3)	// not saving/loading any sounds/music
				continue;
			if (a.is_music && this.saveload === 1)	// not saving/loading music
				continue;
			if (!a.is_music && this.saveload === 2)	// not saving/loading sound
				continue;
			playbackTime = a.getPlaybackTime();
			if (a.looping)
				playbackTime = playbackTime % a.getDuration();
			d = {
				"tag": a.tag,
				"buffersrc": a.buffer.src,
				"is_music": a.is_music,
				"playbackTime": playbackTime,
				"volume": a.volume,
				"looping": a.looping,
				"muted": a.is_muted,
				"playbackRate": a.playbackRate,
				"paused": a.is_paused,
				"resume_position": a.resume_position
			};
			if (a.pannerEnabled) {
				d["pan"] = {};
				panobj = d["pan"];
				if (a.objectTracker && a.objectTracker.hasObject()) {
					panobj["objUid"] = a.objectTracker.obj.uid;
				}
				else {
					panobj["x"] = a.panX;
					panobj["y"] = a.panY;
					panobj["a"] = a.panAngle;
				}
				panobj["ia"] = a.panConeInner;
				panobj["oa"] = a.panConeOuter;
				panobj["og"] = a.panConeOuterGain;
			}
			playingarr.push(d);
		}
		var fxobj = o["effects"];
		var fxarr;
		for (p in effects) {
			if (effects.hasOwnProperty(p)) {
				fxarr = [];
				for (i = 0, len = effects[p].length; i < len; i++) {
					fxarr.push({"type": effects[p][i].type, "params": effects[p][i].params});
				}
				fxobj[p] = fxarr;
			}
		}
		return o;
	};
	var objectTrackerUidsToLoad = [];
	instanceProto.loadFromJSON = function (o) {
		var setSilent = o["silent"];
		masterVolume = o["masterVolume"];
		this.listenerZ = o["listenerZ"];
		this.listenerTracker.setObject(null);
		var listenerUid = o["listenerUid"];
		if (listenerUid !== -1) {
			this.listenerTracker.loadUid = listenerUid;
			objectTrackerUidsToLoad.push(this.listenerTracker);
		}
		var playingarr = o["playing"];
		var i, len, d, src, is_music, tag, playbackTime, looping, vol, b, a, p, pan, panObjUid;
		if (this.saveload !== 3) {
			for (i = 0, len = audioInstances.length; i < len; i++) {
				a = audioInstances[i];
				if (a.is_music && this.saveload === 1)
					continue;		// only saving/loading sound: leave music playing
				if (!a.is_music && this.saveload === 2)
					continue;		// only saving/loading music: leave sound playing
				a.stop();
			}
		}
		var fxarr, fxtype, fxparams, fx;
		for (p in effects) {
			if (effects.hasOwnProperty(p)) {
				for (i = 0, len = effects[p].length; i < len; i++)
					effects[p][i].remove();
			}
		}
		cr.wipe(effects);
		for (p in o["effects"]) {
			if (o["effects"].hasOwnProperty(p)) {
				fxarr = o["effects"][p];
				for (i = 0, len = fxarr.length; i < len; i++) {
					fxtype = fxarr[i]["type"];
					fxparams = fxarr[i]["params"];
					switch (fxtype) {
						case "filter":
							addEffectForTag(p, new FilterEffect(fxparams[0], fxparams[1], fxparams[2], fxparams[3], fxparams[4], fxparams[5]));
							break;
						case "delay":
							addEffectForTag(p, new DelayEffect(fxparams[0], fxparams[1], fxparams[2]));
							break;
						case "convolve":
							src = fxparams[2];
							b = this.getAudioBuffer(src, false);
							if (b.bufferObject) {
								fx = new ConvolveEffect(b.bufferObject, fxparams[0], fxparams[1], src);
							}
							else {
								fx = new ConvolveEffect(null, fxparams[0], fxparams[1], src);
								b.normalizeWhenReady = fxparams[0];
								b.convolveWhenReady = fx;
							}
							addEffectForTag(p, fx);
							break;
						case "flanger":
							addEffectForTag(p, new FlangerEffect(fxparams[0], fxparams[1], fxparams[2], fxparams[3], fxparams[4]));
							break;
						case "phaser":
							addEffectForTag(p, new PhaserEffect(fxparams[0], fxparams[1], fxparams[2], fxparams[3], fxparams[4], fxparams[5]));
							break;
						case "gain":
							addEffectForTag(p, new GainEffect(fxparams[0]));
							break;
						case "tremolo":
							addEffectForTag(p, new TremoloEffect(fxparams[0], fxparams[1]));
							break;
						case "ringmod":
							addEffectForTag(p, new RingModulatorEffect(fxparams[0], fxparams[1]));
							break;
						case "distortion":
							addEffectForTag(p, new DistortionEffect(fxparams[0], fxparams[1], fxparams[2], fxparams[3], fxparams[4]));
							break;
						case "compressor":
							addEffectForTag(p, new CompressorEffect(fxparams[0], fxparams[1], fxparams[2], fxparams[3], fxparams[4]));
							break;
						case "analyser":
							addEffectForTag(p, new AnalyserEffect(fxparams[0], fxparams[1]));
							break;
					}
				}
			}
		}
		for (i = 0, len = playingarr.length; i < len; i++) {
			if (this.saveload === 3)	// not saving/loading any sounds/music
				continue;
			d = playingarr[i];
			src = d["buffersrc"];
			is_music = d["is_music"];
			tag = d["tag"];
			playbackTime = d["playbackTime"];
			looping = d["looping"];
			vol = d["volume"];
			pan = d["pan"];
			panObjUid = (pan && pan.hasOwnProperty("objUid")) ? pan["objUid"] : -1;
			if (is_music && this.saveload === 1)	// not saving/loading music
				continue;
			if (!is_music && this.saveload === 2)	// not saving/loading sound
				continue;
			a = this.getAudioInstance(src, tag, is_music, looping, vol);
			if (!a) {
				b = this.getAudioBuffer(src, is_music);
				b.seekWhenReady = playbackTime;
				b.pauseWhenReady = d["paused"];
				if (pan) {
					if (panObjUid !== -1) {
						b.panWhenReady.push({objUid: panObjUid, ia: pan["ia"], oa: pan["oa"], og: pan["og"], thistag: tag});
					}
					else {
						b.panWhenReady.push({
							x: pan["x"],
							y: pan["y"],
							a: pan["a"],
							ia: pan["ia"],
							oa: pan["oa"],
							og: pan["og"],
							thistag: tag
						});
					}
				}
				continue;
			}
			a.resume_position = d["resume_position"];
			a.setPannerEnabled(!!pan);
			a.play(looping, vol, playbackTime);
			a.updatePlaybackRate();
			a.updateVolume();
			a.doSetMuted(a.is_muted || a.is_silent);
			if (d["paused"])
				a.pause();
			if (d["muted"])
				a.setMuted(true);
			a.doSetMuted(a.is_muted || a.is_silent);
			if (pan) {
				if (panObjUid !== -1) {
					a.objectTracker = a.objectTracker || new ObjectTracker();
					a.objectTracker.loadUid = panObjUid;
					objectTrackerUidsToLoad.push(a.objectTracker);
				}
				else {
					a.setPan(pan["x"], pan["y"], pan["a"], pan["ia"], pan["oa"], pan["og"]);
				}
			}
		}
		if (setSilent && !silent)			// setting silent
		{
			for (i = 0, len = audioInstances.length; i < len; i++)
				audioInstances[i].setSilent(true);
			silent = true;
		}
		else if (!setSilent && silent)		// setting not silent
		{
			for (i = 0, len = audioInstances.length; i < len; i++)
				audioInstances[i].setSilent(false);
			silent = false;
		}
	};
	instanceProto.afterLoad = function () {
		var i, len, ot, inst;
		for (i = 0, len = objectTrackerUidsToLoad.length; i < len; i++) {
			ot = objectTrackerUidsToLoad[i];
			inst = this.runtime.getObjectByUID(ot.loadUid);
			ot.setObject(inst);
			ot.loadUid = -1;
			if (inst) {
				listenerX = inst.x;
				listenerY = inst.y;
			}
		}
		cr.clearArray(objectTrackerUidsToLoad);
	};
	instanceProto.onSuspend = function (s) {
		if (this.playinbackground)
			return;
		if (!s && context && context["resume"]) {
			context["resume"]();
			isContextSuspended = false;
		}
		var i, len;
		for (i = 0, len = audioInstances.length; i < len; i++)
			audioInstances[i].setSuspended(s);
		if (s && context && context["suspend"]) {
			context["suspend"]();
			isContextSuspended = true;
		}
	};
	instanceProto.tick = function () {
		var dt = this.runtime.dt;
		var i, len, a;
		for (i = 0, len = audioInstances.length; i < len; i++) {
			a = audioInstances[i];
			a.tick(dt);
			if (timescale_mode !== 0)
				a.updatePlaybackRate();
		}
		var p, arr, f;
		for (p in effects) {
			if (effects.hasOwnProperty(p)) {
				arr = effects[p];
				for (i = 0, len = arr.length; i < len; i++) {
					f = arr[i];
					if (f.tick)
						f.tick();
				}
			}
		}
		if (api === API_WEBAUDIO && this.listenerTracker.hasObject()) {
			this.listenerTracker.tick(dt);
			listenerX = this.listenerTracker.obj.x;
			listenerY = this.listenerTracker.obj.y;
			context["listener"]["setPosition"](this.listenerTracker.obj.x, this.listenerTracker.obj.y, this.listenerZ);
		}
	};
	var preload_list = [];
	instanceProto.setPreloadList = function (arr) {
		var i, len, p, filename, size, isOgg;
		var total_size = 0;
		for (i = 0, len = arr.length; i < len; ++i) {
			p = arr[i];
			filename = p[0];
			size = p[1] * 2;
			isOgg = (filename.length > 4 && filename.substr(filename.length - 4) === ".ogg");
			if ((isOgg && useOgg) || (!isOgg && !useOgg)) {
				preload_list.push({
					filename: filename,
					size: size,
					obj: null
				});
				total_size += size;
			}
		}
		return total_size;
	};
	instanceProto.startPreloads = function () {
		var i, len, p, src;
		for (i = 0, len = preload_list.length; i < len; ++i) {
			p = preload_list[i];
			src = this.runtime.files_subfolder + p.filename;
			p.obj = this.getAudioBuffer(src, false);
		}
	};
	instanceProto.getPreloadedSize = function () {
		var completed = 0;
		var i, len, p;
		for (i = 0, len = preload_list.length; i < len; ++i) {
			p = preload_list[i];
			if (p.obj.isLoadedAndDecoded() || p.obj.hasFailedToLoad() || this.runtime.isDomFree || this.runtime.isAndroidStockBrowser) {
				completed += p.size;
			}
			else if (p.obj.isLoaded())	// downloaded but not decoded: only happens in Web Audio API, count as half-way progress
			{
				completed += Math.floor(p.size / 2);
			}
		}
		;
		return completed;
	};
	instanceProto.releaseAllMusicBuffers = function () {
		var i, len, j, b;
		for (i = 0, j = 0, len = audioBuffers.length; i < len; ++i) {
			b = audioBuffers[i];
			audioBuffers[j] = b;
			if (b.is_music)
				b.release();
			else
				++j;		// keep
		}
		audioBuffers.length = j;
	};
	instanceProto.getAudioBuffer = function (src_, is_music, dont_create) {
		var i, len, a, ret = null, j, k, lenj, ai;
		for (i = 0, len = audioBuffers.length; i < len; i++) {
			a = audioBuffers[i];
			if (a.src === src_) {
				ret = a;
				break;
			}
		}
		if (!ret && !dont_create) {
			if (playMusicAsSoundWorkaround && is_music)
				this.releaseAllMusicBuffers();
			ret = new C2AudioBuffer(src_, is_music);
			audioBuffers.push(ret);
		}
		return ret;
	};
	instanceProto.getAudioInstance = function (src_, tag, is_music, looping, vol) {
		var i, len, a;
		for (i = 0, len = audioInstances.length; i < len; i++) {
			a = audioInstances[i];
			if (a.src === src_ && (a.canBeRecycled() || is_music)) {
				a.tag = tag;
				return a;
			}
		}
		var b = this.getAudioBuffer(src_, is_music);
		if (!b.bufferObject) {
			if (tag !== "<preload>") {
				b.playTagWhenReady = tag;
				b.loopWhenReady = looping;
				b.volumeWhenReady = vol;
			}
			return null;
		}
		a = new C2AudioInstance(b, tag);
		audioInstances.push(a);
		return a;
	};
	var taggedAudio = [];

	function SortByIsPlaying(a, b) {
		var an = a.isPlaying() ? 1 : 0;
		var bn = b.isPlaying() ? 1 : 0;
		if (an === bn)
			return 0;
		else if (an < bn)
			return 1;
		else
			return -1;
	};

	function getAudioByTag(tag, sort_by_playing) {
		cr.clearArray(taggedAudio);
		if (!tag.length) {
			if (!lastAudio || lastAudio.hasEnded())
				return;
			else {
				cr.clearArray(taggedAudio);
				taggedAudio[0] = lastAudio;
				return;
			}
		}
		var i, len, a;
		for (i = 0, len = audioInstances.length; i < len; i++) {
			a = audioInstances[i];
			if (cr.equals_nocase(tag, a.tag))
				taggedAudio.push(a);
		}
		if (sort_by_playing)
			taggedAudio.sort(SortByIsPlaying);
	};

	function reconnectEffects(tag) {
		var i, len, arr, n, toNode = context["destination"];
		if (effects.hasOwnProperty(tag)) {
			arr = effects[tag];
			if (arr.length) {
				toNode = arr[0].getInputNode();
				for (i = 0, len = arr.length; i < len; i++) {
					n = arr[i];
					if (i + 1 === len)
						n.connectTo(context["destination"]);
					else
						n.connectTo(arr[i + 1].getInputNode());
				}
			}
		}
		getAudioByTag(tag);
		for (i = 0, len = taggedAudio.length; i < len; i++)
			taggedAudio[i].reconnect(toNode);
		if (micSource && micTag === tag) {
			micSource["disconnect"]();
			micSource["connect"](toNode);
		}
	};

	function addEffectForTag(tag, fx) {
		if (!effects.hasOwnProperty(tag))
			effects[tag] = [fx];
		else
			effects[tag].push(fx);
		reconnectEffects(tag);
	};

	function Cnds() {
	};
	Cnds.prototype.OnEnded = function (t) {
		return cr.equals_nocase(audTag, t);
	};
	Cnds.prototype.PreloadsComplete = function () {
		var i, len;
		for (i = 0, len = audioBuffers.length; i < len; i++) {
			if (!audioBuffers[i].isLoadedAndDecoded() && !audioBuffers[i].hasFailedToLoad())
				return false;
		}
		return true;
	};
	Cnds.prototype.AdvancedAudioSupported = function () {
		return api === API_WEBAUDIO;
	};
	Cnds.prototype.IsSilent = function () {
		return silent;
	};
	Cnds.prototype.IsAnyPlaying = function () {
		var i, len;
		for (i = 0, len = audioInstances.length; i < len; i++) {
			if (audioInstances[i].isPlaying())
				return true;
		}
		return false;
	};
	Cnds.prototype.IsTagPlaying = function (tag) {
		getAudioByTag(tag);
		var i, len;
		for (i = 0, len = taggedAudio.length; i < len; i++) {
			if (taggedAudio[i].isPlaying())
				return true;
		}
		return false;
	};
	pluginProto.cnds = new Cnds();

	function Acts() {
	};
	Acts.prototype.Play = function (file, looping, vol, tag) {
		if (silent)
			return;
		var v = dbToLinear(vol);
		var is_music = file[1];
		var src = this.runtime.files_subfolder + file[0] + (useOgg ? ".ogg" : ".m4a");
		lastAudio = this.getAudioInstance(src, tag, is_music, looping !== 0, v);
		if (!lastAudio)
			return;
		lastAudio.setPannerEnabled(false);
		lastAudio.play(looping !== 0, v, 0, this.nextPlayTime);
		this.nextPlayTime = 0;
	};
	Acts.prototype.PlayAtPosition = function (file, looping, vol, x_, y_, angle_, innerangle_, outerangle_, outergain_, tag) {
		if (silent)
			return;
		var v = dbToLinear(vol);
		var is_music = file[1];
		var src = this.runtime.files_subfolder + file[0] + (useOgg ? ".ogg" : ".m4a");
		lastAudio = this.getAudioInstance(src, tag, is_music, looping !== 0, v);
		if (!lastAudio) {
			var b = this.getAudioBuffer(src, is_music);
			b.panWhenReady.push({
				x: x_,
				y: y_,
				a: angle_,
				ia: innerangle_,
				oa: outerangle_,
				og: dbToLinear(outergain_),
				thistag: tag
			});
			return;
		}
		lastAudio.setPannerEnabled(true);
		lastAudio.setPan(x_, y_, angle_, innerangle_, outerangle_, dbToLinear(outergain_));
		lastAudio.play(looping !== 0, v, 0, this.nextPlayTime);
		this.nextPlayTime = 0;
	};
	Acts.prototype.PlayAtObject = function (file, looping, vol, obj, innerangle, outerangle, outergain, tag) {
		if (silent || !obj)
			return;
		var inst = obj.getFirstPicked();
		if (!inst)
			return;
		var v = dbToLinear(vol);
		var is_music = file[1];
		var src = this.runtime.files_subfolder + file[0] + (useOgg ? ".ogg" : ".m4a");
		lastAudio = this.getAudioInstance(src, tag, is_music, looping !== 0, v);
		if (!lastAudio) {
			var b = this.getAudioBuffer(src, is_music);
			b.panWhenReady.push({obj: inst, ia: innerangle, oa: outerangle, og: dbToLinear(outergain), thistag: tag});
			return;
		}
		lastAudio.setPannerEnabled(true);
		var px = cr.rotatePtAround(inst.x, inst.y, -inst.layer.getAngle(), listenerX, listenerY, true);
		var py = cr.rotatePtAround(inst.x, inst.y, -inst.layer.getAngle(), listenerX, listenerY, false);
		lastAudio.setPan(px, py, cr.to_degrees(inst.angle - inst.layer.getAngle()), innerangle, outerangle, dbToLinear(outergain));
		lastAudio.setObject(inst);
		lastAudio.play(looping !== 0, v, 0, this.nextPlayTime);
		this.nextPlayTime = 0;
	};
	Acts.prototype.PlayByName = function (folder, filename, looping, vol, tag) {
		if (silent)
			return;
		var v = dbToLinear(vol);
		var is_music = (folder === 1);
		var src = this.runtime.files_subfolder + filename.toLowerCase() + (useOgg ? ".ogg" : ".m4a");
		lastAudio = this.getAudioInstance(src, tag, is_music, looping !== 0, v);
		if (!lastAudio)
			return;
		lastAudio.setPannerEnabled(false);
		lastAudio.play(looping !== 0, v, 0, this.nextPlayTime);
		this.nextPlayTime = 0;
	};
	Acts.prototype.PlayAtPositionByName = function (folder, filename, looping, vol, x_, y_, angle_, innerangle_, outerangle_, outergain_, tag) {
		if (silent)
			return;
		var v = dbToLinear(vol);
		var is_music = (folder === 1);
		var src = this.runtime.files_subfolder + filename.toLowerCase() + (useOgg ? ".ogg" : ".m4a");
		lastAudio = this.getAudioInstance(src, tag, is_music, looping !== 0, v);
		if (!lastAudio) {
			var b = this.getAudioBuffer(src, is_music);
			b.panWhenReady.push({
				x: x_,
				y: y_,
				a: angle_,
				ia: innerangle_,
				oa: outerangle_,
				og: dbToLinear(outergain_),
				thistag: tag
			});
			return;
		}
		lastAudio.setPannerEnabled(true);
		lastAudio.setPan(x_, y_, angle_, innerangle_, outerangle_, dbToLinear(outergain_));
		lastAudio.play(looping !== 0, v, 0, this.nextPlayTime);
		this.nextPlayTime = 0;
	};
	Acts.prototype.PlayAtObjectByName = function (folder, filename, looping, vol, obj, innerangle, outerangle, outergain, tag) {
		if (silent || !obj)
			return;
		var inst = obj.getFirstPicked();
		if (!inst)
			return;
		var v = dbToLinear(vol);
		var is_music = (folder === 1);
		var src = this.runtime.files_subfolder + filename.toLowerCase() + (useOgg ? ".ogg" : ".m4a");
		lastAudio = this.getAudioInstance(src, tag, is_music, looping !== 0, v);
		if (!lastAudio) {
			var b = this.getAudioBuffer(src, is_music);
			b.panWhenReady.push({obj: inst, ia: innerangle, oa: outerangle, og: dbToLinear(outergain), thistag: tag});
			return;
		}
		lastAudio.setPannerEnabled(true);
		var px = cr.rotatePtAround(inst.x, inst.y, -inst.layer.getAngle(), listenerX, listenerY, true);
		var py = cr.rotatePtAround(inst.x, inst.y, -inst.layer.getAngle(), listenerX, listenerY, false);
		lastAudio.setPan(px, py, cr.to_degrees(inst.angle - inst.layer.getAngle()), innerangle, outerangle, dbToLinear(outergain));
		lastAudio.setObject(inst);
		lastAudio.play(looping !== 0, v, 0, this.nextPlayTime);
		this.nextPlayTime = 0;
	};
	Acts.prototype.SetLooping = function (tag, looping) {
		getAudioByTag(tag);
		var i, len;
		for (i = 0, len = taggedAudio.length; i < len; i++)
			taggedAudio[i].setLooping(looping === 0);
	};
	Acts.prototype.SetMuted = function (tag, muted) {
		getAudioByTag(tag);
		var i, len;
		for (i = 0, len = taggedAudio.length; i < len; i++)
			taggedAudio[i].setMuted(muted === 0);
	};
	Acts.prototype.SetVolume = function (tag, vol) {
		getAudioByTag(tag);
		var v = dbToLinear(vol);
		var i, len;
		for (i = 0, len = taggedAudio.length; i < len; i++)
			taggedAudio[i].setVolume(v);
	};
	Acts.prototype.Preload = function (file) {
		if (silent)
			return;
		var is_music = file[1];
		var src = this.runtime.files_subfolder + file[0] + (useOgg ? ".ogg" : ".m4a");
		if (api === API_APPMOBI) {
			if (this.runtime.isDirectCanvas)
				AppMobi["context"]["loadSound"](src);
			else
				AppMobi["player"]["loadSound"](src);
			return;
		}
		else if (api === API_CORDOVA) {
			return;
		}
		this.getAudioInstance(src, "<preload>", is_music, false);
	};
	Acts.prototype.PreloadByName = function (folder, filename) {
		if (silent)
			return;
		var is_music = (folder === 1);
		var src = this.runtime.files_subfolder + filename.toLowerCase() + (useOgg ? ".ogg" : ".m4a");
		if (api === API_APPMOBI) {
			if (this.runtime.isDirectCanvas)
				AppMobi["context"]["loadSound"](src);
			else
				AppMobi["player"]["loadSound"](src);
			return;
		}
		else if (api === API_CORDOVA) {
			return;
		}
		this.getAudioInstance(src, "<preload>", is_music, false);
	};
	Acts.prototype.SetPlaybackRate = function (tag, rate) {
		getAudioByTag(tag);
		if (rate < 0.0)
			rate = 0;
		var i, len;
		for (i = 0, len = taggedAudio.length; i < len; i++)
			taggedAudio[i].setPlaybackRate(rate);
	};
	Acts.prototype.Stop = function (tag) {
		getAudioByTag(tag);
		var i, len;
		for (i = 0, len = taggedAudio.length; i < len; i++)
			taggedAudio[i].stop();
	};
	Acts.prototype.StopAll = function () {
		var i, len;
		for (i = 0, len = audioInstances.length; i < len; i++)
			audioInstances[i].stop();
	};
	Acts.prototype.SetPaused = function (tag, state) {
		getAudioByTag(tag);
		var i, len;
		for (i = 0, len = taggedAudio.length; i < len; i++) {
			if (state === 0)
				taggedAudio[i].pause();
			else
				taggedAudio[i].resume();
		}
	};
	Acts.prototype.Seek = function (tag, pos) {
		getAudioByTag(tag);
		var i, len;
		for (i = 0, len = taggedAudio.length; i < len; i++) {
			taggedAudio[i].seek(pos);
		}
	};
	Acts.prototype.SetSilent = function (s) {
		var i, len;
		if (s === 2)					// toggling
			s = (silent ? 1 : 0);		// choose opposite state
		if (s === 0 && !silent)			// setting silent
		{
			for (i = 0, len = audioInstances.length; i < len; i++)
				audioInstances[i].setSilent(true);
			silent = true;
		}
		else if (s === 1 && silent)		// setting not silent
		{
			for (i = 0, len = audioInstances.length; i < len; i++)
				audioInstances[i].setSilent(false);
			silent = false;
		}
	};
	Acts.prototype.SetMasterVolume = function (vol) {
		masterVolume = dbToLinear(vol);
		var i, len;
		for (i = 0, len = audioInstances.length; i < len; i++)
			audioInstances[i].updateVolume();
	};
	Acts.prototype.AddFilterEffect = function (tag, type, freq, detune, q, gain, mix) {
		if (api !== API_WEBAUDIO || type < 0 || type >= filterTypes.length || !context["createBiquadFilter"])
			return;
		tag = tag.toLowerCase();
		mix = mix / 100;
		if (mix < 0) mix = 0;
		if (mix > 1) mix = 1;
		addEffectForTag(tag, new FilterEffect(type, freq, detune, q, gain, mix));
	};
	Acts.prototype.AddDelayEffect = function (tag, delay, gain, mix) {
		if (api !== API_WEBAUDIO)
			return;
		tag = tag.toLowerCase();
		mix = mix / 100;
		if (mix < 0) mix = 0;
		if (mix > 1) mix = 1;
		addEffectForTag(tag, new DelayEffect(delay, dbToLinear(gain), mix));
	};
	Acts.prototype.AddFlangerEffect = function (tag, delay, modulation, freq, feedback, mix) {
		if (api !== API_WEBAUDIO || !context["createOscillator"])
			return;
		tag = tag.toLowerCase();
		mix = mix / 100;
		if (mix < 0) mix = 0;
		if (mix > 1) mix = 1;
		addEffectForTag(tag, new FlangerEffect(delay / 1000, modulation / 1000, freq, feedback / 100, mix));
	};
	Acts.prototype.AddPhaserEffect = function (tag, freq, detune, q, mod, modfreq, mix) {
		if (api !== API_WEBAUDIO || !context["createOscillator"])
			return;
		tag = tag.toLowerCase();
		mix = mix / 100;
		if (mix < 0) mix = 0;
		if (mix > 1) mix = 1;
		addEffectForTag(tag, new PhaserEffect(freq, detune, q, mod, modfreq, mix));
	};
	Acts.prototype.AddConvolutionEffect = function (tag, file, norm, mix) {
		if (api !== API_WEBAUDIO || !context["createConvolver"])
			return;
		var doNormalize = (norm === 0);
		var src = this.runtime.files_subfolder + file[0] + (useOgg ? ".ogg" : ".m4a");
		var b = this.getAudioBuffer(src, false);
		tag = tag.toLowerCase();
		mix = mix / 100;
		if (mix < 0) mix = 0;
		if (mix > 1) mix = 1;
		var fx;
		if (b.bufferObject) {
			fx = new ConvolveEffect(b.bufferObject, doNormalize, mix, src);
		}
		else {
			fx = new ConvolveEffect(null, doNormalize, mix, src);
			b.normalizeWhenReady = doNormalize;
			b.convolveWhenReady = fx;
		}
		addEffectForTag(tag, fx);
	};
	Acts.prototype.AddGainEffect = function (tag, g) {
		if (api !== API_WEBAUDIO)
			return;
		tag = tag.toLowerCase();
		addEffectForTag(tag, new GainEffect(dbToLinear(g)));
	};
	Acts.prototype.AddMuteEffect = function (tag) {
		if (api !== API_WEBAUDIO)
			return;
		tag = tag.toLowerCase();
		addEffectForTag(tag, new GainEffect(0));	// re-use gain effect with 0 gain
	};
	Acts.prototype.AddTremoloEffect = function (tag, freq, mix) {
		if (api !== API_WEBAUDIO || !context["createOscillator"])
			return;
		tag = tag.toLowerCase();
		mix = mix / 100;
		if (mix < 0) mix = 0;
		if (mix > 1) mix = 1;
		addEffectForTag(tag, new TremoloEffect(freq, mix));
	};
	Acts.prototype.AddRingModEffect = function (tag, freq, mix) {
		if (api !== API_WEBAUDIO || !context["createOscillator"])
			return;
		tag = tag.toLowerCase();
		mix = mix / 100;
		if (mix < 0) mix = 0;
		if (mix > 1) mix = 1;
		addEffectForTag(tag, new RingModulatorEffect(freq, mix));
	};
	Acts.prototype.AddDistortionEffect = function (tag, threshold, headroom, drive, makeupgain, mix) {
		if (api !== API_WEBAUDIO || !context["createWaveShaper"])
			return;
		tag = tag.toLowerCase();
		mix = mix / 100;
		if (mix < 0) mix = 0;
		if (mix > 1) mix = 1;
		addEffectForTag(tag, new DistortionEffect(threshold, headroom, drive, makeupgain, mix));
	};
	Acts.prototype.AddCompressorEffect = function (tag, threshold, knee, ratio, attack, release) {
		if (api !== API_WEBAUDIO || !context["createDynamicsCompressor"])
			return;
		tag = tag.toLowerCase();
		addEffectForTag(tag, new CompressorEffect(threshold, knee, ratio, attack / 1000, release / 1000));
	};
	Acts.prototype.AddAnalyserEffect = function (tag, fftSize, smoothing) {
		if (api !== API_WEBAUDIO)
			return;
		tag = tag.toLowerCase();
		addEffectForTag(tag, new AnalyserEffect(fftSize, smoothing));
	};
	Acts.prototype.RemoveEffects = function (tag) {
		if (api !== API_WEBAUDIO)
			return;
		tag = tag.toLowerCase();
		var i, len, arr;
		if (effects.hasOwnProperty(tag)) {
			arr = effects[tag];
			if (arr.length) {
				for (i = 0, len = arr.length; i < len; i++)
					arr[i].remove();
				cr.clearArray(arr);
				reconnectEffects(tag);
			}
		}
	};
	Acts.prototype.SetEffectParameter = function (tag, index, param, value, ramp, time) {
		if (api !== API_WEBAUDIO)
			return;
		tag = tag.toLowerCase();
		index = Math.floor(index);
		var arr;
		if (!effects.hasOwnProperty(tag))
			return;
		arr = effects[tag];
		if (index < 0 || index >= arr.length)
			return;
		arr[index].setParam(param, value, ramp, time);
	};
	Acts.prototype.SetListenerObject = function (obj_) {
		if (!obj_ || api !== API_WEBAUDIO)
			return;
		var inst = obj_.getFirstPicked();
		if (!inst)
			return;
		this.listenerTracker.setObject(inst);
		listenerX = inst.x;
		listenerY = inst.y;
	};
	Acts.prototype.SetListenerZ = function (z) {
		this.listenerZ = z;
	};
	Acts.prototype.ScheduleNextPlay = function (t) {
		if (!context)
			return;		// needs Web Audio API
		this.nextPlayTime = t;
	};
	Acts.prototype.UnloadAudio = function (file) {
		var is_music = file[1];
		var src = this.runtime.files_subfolder + file[0] + (useOgg ? ".ogg" : ".m4a");
		var b = this.getAudioBuffer(src, is_music, true /* don't create if missing */);
		if (!b)
			return;		// not loaded
		b.release();
		cr.arrayFindRemove(audioBuffers, b);
	};
	Acts.prototype.UnloadAudioByName = function (folder, filename) {
		var is_music = (folder === 1);
		var src = this.runtime.files_subfolder + filename.toLowerCase() + (useOgg ? ".ogg" : ".m4a");
		var b = this.getAudioBuffer(src, is_music, true /* don't create if missing */);
		if (!b)
			return;		// not loaded
		b.release();
		cr.arrayFindRemove(audioBuffers, b);
	};
	Acts.prototype.UnloadAll = function () {
		var i, len;
		for (i = 0, len = audioBuffers.length; i < len; ++i) {
			audioBuffers[i].release();
		}
		;
		cr.clearArray(audioBuffers);
	};
	pluginProto.acts = new Acts();

	function Exps() {
	};
	Exps.prototype.Duration = function (ret, tag) {
		getAudioByTag(tag, true);
		if (taggedAudio.length)
			ret.set_float(taggedAudio[0].getDuration());
		else
			ret.set_float(0);
	};
	Exps.prototype.PlaybackTime = function (ret, tag) {
		getAudioByTag(tag, true);
		if (taggedAudio.length)
			ret.set_float(taggedAudio[0].getPlaybackTime(true));
		else
			ret.set_float(0);
	};
	Exps.prototype.Volume = function (ret, tag) {
		getAudioByTag(tag, true);
		if (taggedAudio.length) {
			var v = taggedAudio[0].getVolume();
			ret.set_float(linearToDb(v));
		}
		else
			ret.set_float(0);
	};
	Exps.prototype.MasterVolume = function (ret) {
		ret.set_float(linearToDb(masterVolume));
	};
	Exps.prototype.EffectCount = function (ret, tag) {
		tag = tag.toLowerCase();
		var arr = null;
		if (effects.hasOwnProperty(tag))
			arr = effects[tag];
		ret.set_int(arr ? arr.length : 0);
	};

	function getAnalyser(tag, index) {
		var arr = null;
		if (effects.hasOwnProperty(tag))
			arr = effects[tag];
		if (arr && index >= 0 && index < arr.length && arr[index].freqBins)
			return arr[index];
		else
			return null;
	};
	Exps.prototype.AnalyserFreqBinCount = function (ret, tag, index) {
		tag = tag.toLowerCase();
		index = Math.floor(index);
		var analyser = getAnalyser(tag, index);
		ret.set_int(analyser ? analyser.node["frequencyBinCount"] : 0);
	};
	Exps.prototype.AnalyserFreqBinAt = function (ret, tag, index, bin) {
		tag = tag.toLowerCase();
		index = Math.floor(index);
		bin = Math.floor(bin);
		var analyser = getAnalyser(tag, index);
		if (!analyser)
			ret.set_float(0);
		else if (bin < 0 || bin >= analyser.node["frequencyBinCount"])
			ret.set_float(0);
		else
			ret.set_float(analyser.freqBins[bin]);
	};
	Exps.prototype.AnalyserPeakLevel = function (ret, tag, index) {
		tag = tag.toLowerCase();
		index = Math.floor(index);
		var analyser = getAnalyser(tag, index);
		if (analyser)
			ret.set_float(analyser.peak);
		else
			ret.set_float(0);
	};
	Exps.prototype.AnalyserRMSLevel = function (ret, tag, index) {
		tag = tag.toLowerCase();
		index = Math.floor(index);
		var analyser = getAnalyser(tag, index);
		if (analyser)
			ret.set_float(analyser.rms);
		else
			ret.set_float(0);
	};
	Exps.prototype.SampleRate = function (ret) {
		ret.set_int(context ? context.sampleRate : 0);
	};
	Exps.prototype.CurrentTime = function (ret) {
		ret.set_float(context ? context.currentTime : cr.performance_now());
	};
	pluginProto.exps = new Exps();
}());
cr.plugins_.Browser = function(runtime)
{
	this.runtime = runtime;
};
(function () {
	var pluginProto = cr.plugins_.Browser.prototype;
	pluginProto.Type = function (plugin) {
		this.plugin = plugin;
		this.runtime = plugin.runtime;
	};
	var typeProto = pluginProto.Type.prototype;
	typeProto.onCreate = function () {
	};
	var offlineScriptReady = false;
	var browserPluginReady = false;
	document.addEventListener("DOMContentLoaded", function () {
		if (window["C2_RegisterSW"] && navigator.serviceWorker) {
			var offlineClientScript = document.createElement("script");
			offlineClientScript.onload = function () {
				offlineScriptReady = true;
				checkReady()
			};
			offlineClientScript.src = "offlineClient.js";
			document.head.appendChild(offlineClientScript);
		}
	});
	var browserInstance = null;
	typeProto.onAppBegin = function () {
		browserPluginReady = true;
		checkReady();
	};

	function checkReady() {
		if (offlineScriptReady && browserPluginReady && window["OfflineClientInfo"]) {
			window["OfflineClientInfo"]["SetMessageCallback"](function (e) {
				browserInstance.onSWMessage(e);
			});
		}
	};
	pluginProto.Instance = function (type) {
		this.type = type;
		this.runtime = type.runtime;
	};
	var instanceProto = pluginProto.Instance.prototype;
	instanceProto.onCreate = function () {
		var self = this;
		window.addEventListener("resize", function () {
			self.runtime.trigger(cr.plugins_.Browser.prototype.cnds.OnResize, self);
		});
		browserInstance = this;
		if (typeof navigator.onLine !== "undefined") {
			window.addEventListener("online", function () {
				self.runtime.trigger(cr.plugins_.Browser.prototype.cnds.OnOnline, self);
			});
			window.addEventListener("offline", function () {
				self.runtime.trigger(cr.plugins_.Browser.prototype.cnds.OnOffline, self);
			});
		}
		if (typeof window.applicationCache !== "undefined") {
			window.applicationCache.addEventListener('updateready', function () {
				self.runtime.loadingprogress = 1;
				self.runtime.trigger(cr.plugins_.Browser.prototype.cnds.OnUpdateReady, self);
			});
			window.applicationCache.addEventListener('progress', function (e) {
				self.runtime.loadingprogress = (e["loaded"] / e["total"]) || 0;
			});
		}
		if (!this.runtime.isDirectCanvas) {
			document.addEventListener("appMobi.device.update.available", function () {
				self.runtime.trigger(cr.plugins_.Browser.prototype.cnds.OnUpdateReady, self);
			});
			document.addEventListener("backbutton", function () {
				self.runtime.trigger(cr.plugins_.Browser.prototype.cnds.OnBackButton, self);
			});
			document.addEventListener("menubutton", function () {
				self.runtime.trigger(cr.plugins_.Browser.prototype.cnds.OnMenuButton, self);
			});
			document.addEventListener("searchbutton", function () {
				self.runtime.trigger(cr.plugins_.Browser.prototype.cnds.OnSearchButton, self);
			});
			document.addEventListener("tizenhwkey", function (e) {
				var ret;
				switch (e["keyName"]) {
					case "back":
						ret = self.runtime.trigger(cr.plugins_.Browser.prototype.cnds.OnBackButton, self);
						if (!ret) {
							if (window["tizen"])
								window["tizen"]["application"]["getCurrentApplication"]()["exit"]();
						}
						break;
					case "menu":
						ret = self.runtime.trigger(cr.plugins_.Browser.prototype.cnds.OnMenuButton, self);
						if (!ret)
							e.preventDefault();
						break;
				}
			});
		}
		if (this.runtime.isWindows10 && typeof Windows !== "undefined") {
			Windows["UI"]["Core"]["SystemNavigationManager"]["getForCurrentView"]().addEventListener("backrequested", function (e) {
				var ret = self.runtime.trigger(cr.plugins_.Browser.prototype.cnds.OnBackButton, self);
				if (ret)
					e.handled = true;
			});
		}
		else if (this.runtime.isWinJS && WinJS["Application"]) {
			WinJS["Application"]["onbackclick"] = function (e) {
				return !!self.runtime.trigger(cr.plugins_.Browser.prototype.cnds.OnBackButton, self);
			};
		}
		this.runtime.addSuspendCallback(function (s) {
			if (s) {
				self.runtime.trigger(cr.plugins_.Browser.prototype.cnds.OnPageHidden, self);
			}
			else {
				self.runtime.trigger(cr.plugins_.Browser.prototype.cnds.OnPageVisible, self);
			}
		});
		this.is_arcade = (typeof window["is_scirra_arcade"] !== "undefined");
	};
	instanceProto.onSWMessage = function (e) {
		var messageType = e.data.type;
		if (messageType === "downloading-update")
			this.runtime.trigger(cr.plugins_.Browser.prototype.cnds.OnUpdateFound, this);
		else if (messageType === "update-ready" || messageType === "update-pending")
			this.runtime.trigger(cr.plugins_.Browser.prototype.cnds.OnUpdateReady, this);
		else if (messageType === "offline-ready")
			this.runtime.trigger(cr.plugins_.Browser.prototype.cnds.OnOfflineReady, this);
	};
	var batteryManager = null;
	var loadedBatteryManager = false;

	function maybeLoadBatteryManager() {
		if (loadedBatteryManager)
			return;
		if (!navigator["getBattery"])
			return;
		var promise = navigator["getBattery"]();
		loadedBatteryManager = true;
		if (promise) {
			promise.then(function (manager) {
				batteryManager = manager;
			});
		}
	};

	function Cnds() {
	};
	Cnds.prototype.CookiesEnabled = function () {
		return navigator ? navigator.cookieEnabled : false;
	};
	Cnds.prototype.IsOnline = function () {
		return navigator ? navigator.onLine : false;
	};
	Cnds.prototype.HasJava = function () {
		return navigator ? navigator.javaEnabled() : false;
	};
	Cnds.prototype.OnOnline = function () {
		return true;
	};
	Cnds.prototype.OnOffline = function () {
		return true;
	};
	Cnds.prototype.IsDownloadingUpdate = function () {
		if (typeof window["applicationCache"] === "undefined")
			return false;
		else
			return window["applicationCache"]["status"] === window["applicationCache"]["DOWNLOADING"];
	};
	Cnds.prototype.OnUpdateReady = function () {
		return true;
	};
	Cnds.prototype.PageVisible = function () {
		return !this.runtime.isSuspended;
	};
	Cnds.prototype.OnPageVisible = function () {
		return true;
	};
	Cnds.prototype.OnPageHidden = function () {
		return true;
	};
	Cnds.prototype.OnResize = function () {
		return true;
	};
	Cnds.prototype.IsFullscreen = function () {
		return !!(document["mozFullScreen"] || document["webkitIsFullScreen"] || document["fullScreen"] || this.runtime.isNodeFullscreen);
	};
	Cnds.prototype.OnBackButton = function () {
		return true;
	};
	Cnds.prototype.OnMenuButton = function () {
		return true;
	};
	Cnds.prototype.OnSearchButton = function () {
		return true;
	};
	Cnds.prototype.IsMetered = function () {
		var connection = navigator["connection"] || navigator["mozConnection"] || navigator["webkitConnection"];
		if (!connection)
			return false;
		return !!connection["metered"];
	};
	Cnds.prototype.IsCharging = function () {
		var battery = navigator["battery"] || navigator["mozBattery"] || navigator["webkitBattery"];
		if (battery) {
			return !!battery["charging"]
		}
		else {
			maybeLoadBatteryManager();
			if (batteryManager) {
				return !!batteryManager["charging"];
			}
			else {
				return true;		// if unknown, default to charging (powered)
			}
		}
	};
	Cnds.prototype.IsPortraitLandscape = function (p) {
		var current = (window.innerWidth <= window.innerHeight ? 0 : 1);
		return current === p;
	};
	Cnds.prototype.SupportsFullscreen = function () {
		if (this.runtime.isNodeWebkit)
			return true;
		var elem = this.runtime.canvasdiv || this.runtime.canvas;
		return !!(elem["requestFullscreen"] || elem["mozRequestFullScreen"] || elem["msRequestFullscreen"] || elem["webkitRequestFullScreen"]);
	};
	Cnds.prototype.OnUpdateFound = function () {
		return true;
	};
	Cnds.prototype.OnUpdateReady = function () {
		return true;
	};
	Cnds.prototype.OnOfflineReady = function () {
		return true;
	};
	pluginProto.cnds = new Cnds();

	function Acts() {
	};
	Acts.prototype.Alert = function (msg) {
		if (!this.runtime.isDomFree)
			alert(msg.toString());
	};
	Acts.prototype.Close = function () {
		if (this.runtime.isCocoonJs)
			CocoonJS["App"]["forceToFinish"]();
		else if (window["tizen"])
			window["tizen"]["application"]["getCurrentApplication"]()["exit"]();
		else if (navigator["app"] && navigator["app"]["exitApp"])
			navigator["app"]["exitApp"]();
		else if (navigator["device"] && navigator["device"]["exitApp"])
			navigator["device"]["exitApp"]();
		else if (!this.is_arcade && !this.runtime.isDomFree)
			window.close();
	};
	Acts.prototype.Focus = function () {
		if (this.runtime.isNodeWebkit) {
			var win = window["nwgui"]["Window"]["get"]();
			win["focus"]();
		}
		else if (!this.is_arcade && !this.runtime.isDomFree)
			window.focus();
	};
	Acts.prototype.Blur = function () {
		if (this.runtime.isNodeWebkit) {
			var win = window["nwgui"]["Window"]["get"]();
			win["blur"]();
		}
		else if (!this.is_arcade && !this.runtime.isDomFree)
			window.blur();
	};
	Acts.prototype.GoBack = function () {
		if (navigator["app"] && navigator["app"]["backHistory"])
			navigator["app"]["backHistory"]();
		else if (!this.is_arcade && !this.runtime.isDomFree && window.back)
			window.back();
	};
	Acts.prototype.GoForward = function () {
		if (!this.is_arcade && !this.runtime.isDomFree && window.forward)
			window.forward();
	};
	Acts.prototype.GoHome = function () {
		if (!this.is_arcade && !this.runtime.isDomFree && window.home)
			window.home();
	};
	Acts.prototype.Reload = function () {
		if (!this.is_arcade && !this.runtime.isDomFree)
			window.location.reload();
	};
	var firstRequestFullscreen = true;
	var crruntime = null;

	function onFullscreenError(e) {
		if (console && console.warn)
			console.warn("Fullscreen request failed: ", e);
		crruntime["setSize"](window.innerWidth, window.innerHeight);
	};
	Acts.prototype.RequestFullScreen = function (stretchmode) {
		if (this.runtime.isDomFree) {
			cr.logexport("[Construct 2] Requesting fullscreen is not supported on this platform - the request has been ignored");
			return;
		}
		if (stretchmode >= 2)
			stretchmode += 1;
		if (stretchmode === 6)
			stretchmode = 2;
		if (this.runtime.isNodeWebkit) {
			if (this.runtime.isDebug) {
				debuggerFullscreen(true);
			}
			else if (!this.runtime.isNodeFullscreen && window["nwgui"]) {
				window["nwgui"]["Window"]["get"]()["enterFullscreen"]();
				this.runtime.isNodeFullscreen = true;
				this.runtime.fullscreen_scaling = (stretchmode >= 2 ? stretchmode : 0);
			}
		}
		else {
			if (document["mozFullScreen"] || document["webkitIsFullScreen"] || !!document["msFullscreenElement"] || document["fullScreen"] || document["fullScreenElement"]) {
				return;
			}
			this.runtime.fullscreen_scaling = (stretchmode >= 2 ? stretchmode : 0);
			var elem = this.runtime.canvasdiv || this.runtime.canvas;
			if (firstRequestFullscreen) {
				firstRequestFullscreen = false;
				crruntime = this.runtime;
				elem.addEventListener("mozfullscreenerror", onFullscreenError);
				elem.addEventListener("webkitfullscreenerror", onFullscreenError);
				elem.addEventListener("MSFullscreenError", onFullscreenError);
				elem.addEventListener("fullscreenerror", onFullscreenError);
			}
			if (elem["requestFullscreen"])
				elem["requestFullscreen"]();
			else if (elem["mozRequestFullScreen"])
				elem["mozRequestFullScreen"]();
			else if (elem["msRequestFullscreen"])
				elem["msRequestFullscreen"]();
			else if (elem["webkitRequestFullScreen"]) {
				if (typeof Element !== "undefined" && typeof Element["ALLOW_KEYBOARD_INPUT"] !== "undefined")
					elem["webkitRequestFullScreen"](Element["ALLOW_KEYBOARD_INPUT"]);
				else
					elem["webkitRequestFullScreen"]();
			}
		}
	};
	Acts.prototype.CancelFullScreen = function () {
		if (this.runtime.isDomFree) {
			cr.logexport("[Construct 2] Exiting fullscreen is not supported on this platform - the request has been ignored");
			return;
		}
		if (this.runtime.isNodeWebkit) {
			if (this.runtime.isDebug) {
				debuggerFullscreen(false);
			}
			else if (this.runtime.isNodeFullscreen && window["nwgui"]) {
				window["nwgui"]["Window"]["get"]()["leaveFullscreen"]();
				this.runtime.isNodeFullscreen = false;
			}
		}
		else {
			if (document["exitFullscreen"])
				document["exitFullscreen"]();
			else if (document["mozCancelFullScreen"])
				document["mozCancelFullScreen"]();
			else if (document["msExitFullscreen"])
				document["msExitFullscreen"]();
			else if (document["webkitCancelFullScreen"])
				document["webkitCancelFullScreen"]();
		}
	};
	Acts.prototype.Vibrate = function (pattern_) {
		try {
			var arr = pattern_.split(",");
			var i, len;
			for (i = 0, len = arr.length; i < len; i++) {
				arr[i] = parseInt(arr[i], 10);
			}
			if (navigator["vibrate"])
				navigator["vibrate"](arr);
			else if (navigator["mozVibrate"])
				navigator["mozVibrate"](arr);
			else if (navigator["webkitVibrate"])
				navigator["webkitVibrate"](arr);
			else if (navigator["msVibrate"])
				navigator["msVibrate"](arr);
		}
		catch (e) {
		}
	};
	//Acts.prototype.InvokeDownload = function (url_, filename_)
//	{
//		var a = document.createElement("a");
//		if (typeof a["download"] === "undefined")
//		{
//			window.open(url_);
//		}
//		else
//		{
//			var body = document.getElementsByTagName("body")[0];
//			a.textContent = filename_;
//			a.href = url_;
//			a["download"] = filename_;
//			body.appendChild(a);
//			var clickEvent = new MouseEvent("click");
//			a.dispatchEvent(clickEvent);
//			body.removeChild(a);
//		}
//	};
	//Acts.prototype.InvokeDownloadString = function (str_, mimetype_, filename_)
//	{
//		var datauri = "data:" + mimetype_ + "," + encodeURIComponent(str_);
//		var a = document.createElement("a");
//		if (typeof a["download"] === "undefined")
//		{
//			window.open(datauri);
//		}
//		else
//		{
//			var body = document.getElementsByTagName("body")[0];
//			a.textContent = filename_;
//			a.href = datauri;
//			a["download"] = filename_;
//			body.appendChild(a);
//			var clickEvent = new MouseEvent("click");
//			a.dispatchEvent(clickEvent);
//			body.removeChild(a);
//		}
//	};
	Acts.prototype.ConsoleLog = function (type_, msg_) {
		if (typeof console === "undefined")
			return;
		if (type_ === 0 && console.log)
			console.log(msg_.toString());
		if (type_ === 1 && console.warn)
			console.warn(msg_.toString());
		if (type_ === 2 && console.error)
			console.error(msg_.toString());
	};
	Acts.prototype.ConsoleGroup = function (name_) {
		if (console && console.group)
			console.group(name_);
	};
	Acts.prototype.ConsoleGroupEnd = function () {
		if (console && console.groupEnd)
			console.groupEnd();
	};
	Acts.prototype.ExecJs = function (js_) {
		try {
			if (eval)
				eval(js_);
		}
		catch (e) {
			if (console && console.error)
				console.error("Error executing Javascript: ", e);
		}
	};
	var orientations = [
		"portrait",
		"landscape",
		"portrait-primary",
		"portrait-secondary",
		"landscape-primary",
		"landscape-secondary"
	];
	Acts.prototype.LockOrientation = function (o) {
		o = Math.floor(o);
		if (o < 0 || o >= orientations.length)
			return;
		this.runtime.autoLockOrientation = false;
		var orientation = orientations[o];
		if (screen["orientation"] && screen["orientation"]["lock"])
			screen["orientation"]["lock"](orientation);
		else if (screen["lockOrientation"])
			screen["lockOrientation"](orientation);
		else if (screen["webkitLockOrientation"])
			screen["webkitLockOrientation"](orientation);
		else if (screen["mozLockOrientation"])
			screen["mozLockOrientation"](orientation);
		else if (screen["msLockOrientation"])
			screen["msLockOrientation"](orientation);
	};
	Acts.prototype.UnlockOrientation = function () {
		this.runtime.autoLockOrientation = false;
		if (screen["orientation"] && screen["orientation"]["unlock"])
			screen["orientation"]["unlock"]();
		else if (screen["unlockOrientation"])
			screen["unlockOrientation"]();
		else if (screen["webkitUnlockOrientation"])
			screen["webkitUnlockOrientation"]();
		else if (screen["mozUnlockOrientation"])
			screen["mozUnlockOrientation"]();
		else if (screen["msUnlockOrientation"])
			screen["msUnlockOrientation"]();
	};
	pluginProto.acts = new Acts();

	function Exps() {
	};
	Exps.prototype.URL = function (ret) {
		ret.set_string(this.runtime.isDomFree ? "" : window.location.toString());
	};
	Exps.prototype.Protocol = function (ret) {
		ret.set_string(this.runtime.isDomFree ? "" : window.location.protocol);
	};
	Exps.prototype.Domain = function (ret) {
		ret.set_string(this.runtime.isDomFree ? "" : window.location.hostname);
	};
	Exps.prototype.PathName = function (ret) {
		ret.set_string(this.runtime.isDomFree ? "" : window.location.pathname);
	};
	Exps.prototype.Hash = function (ret) {
		ret.set_string(this.runtime.isDomFree ? "" : window.location.hash);
	};
	Exps.prototype.Referrer = function (ret) {
		ret.set_string(this.runtime.isDomFree ? "" : document.referrer);
	};
	Exps.prototype.Title = function (ret) {
		ret.set_string(this.runtime.isDomFree ? "" : document.title);
	};
	Exps.prototype.Name = function (ret) {
		ret.set_string(this.runtime.isDomFree ? "" : navigator.appName);
	};
	Exps.prototype.Version = function (ret) {
		ret.set_string(this.runtime.isDomFree ? "" : navigator.appVersion);
	};
	Exps.prototype.Language = function (ret) {
		if (navigator && navigator.language)
			ret.set_string(navigator.language);
		else
			ret.set_string("");
	};
	Exps.prototype.Platform = function (ret) {
		ret.set_string(this.runtime.isDomFree ? "" : navigator.platform);
	};
	Exps.prototype.Product = function (ret) {
		if (navigator && navigator.product)
			ret.set_string(navigator.product);
		else
			ret.set_string("");
	};
	Exps.prototype.Vendor = function (ret) {
		if (navigator && navigator.vendor)
			ret.set_string(navigator.vendor);
		else
			ret.set_string("");
	};
	Exps.prototype.UserAgent = function (ret) {
		ret.set_string(this.runtime.isDomFree ? "" : navigator.userAgent);
	};
	Exps.prototype.QueryString = function (ret) {
		ret.set_string(this.runtime.isDomFree ? "" : window.location.search);
	};
	Exps.prototype.QueryParam = function (ret, paramname) {
		if (this.runtime.isDomFree) {
			ret.set_string("");
			return;
		}
		var match = RegExp('[?&]' + paramname + '=([^&]*)').exec(window.location.search);
		if (match)
			ret.set_string(decodeURIComponent(match[1].replace(/\+/g, ' ')));
		else
			ret.set_string("");
	};
	Exps.prototype.Bandwidth = function (ret) {
		var connection = navigator["connection"] || navigator["mozConnection"] || navigator["webkitConnection"];
		if (!connection)
			ret.set_float(Number.POSITIVE_INFINITY);
		else {
			if (typeof connection["bandwidth"] !== "undefined")
				ret.set_float(connection["bandwidth"]);
			else if (typeof connection["downlinkMax"] !== "undefined")
				ret.set_float(connection["downlinkMax"]);
			else
				ret.set_float(Number.POSITIVE_INFINITY);
		}
	};
	Exps.prototype.ConnectionType = function (ret) {
		var connection = navigator["connection"] || navigator["mozConnection"] || navigator["webkitConnection"];
		if (!connection)
			ret.set_string("unknown");
		else {
			ret.set_string(connection["type"] || "unknown");
		}
	};
	Exps.prototype.BatteryLevel = function (ret) {
		var battery = navigator["battery"] || navigator["mozBattery"] || navigator["webkitBattery"];
		if (battery) {
			ret.set_float(battery["level"]);
		}
		else {
			maybeLoadBatteryManager();
			if (batteryManager) {
				ret.set_float(batteryManager["level"]);
			}
			else {
				ret.set_float(1);		// not supported/unknown: assume charged
			}
		}
	};
	Exps.prototype.BatteryTimeLeft = function (ret) {
		var battery = navigator["battery"] || navigator["mozBattery"] || navigator["webkitBattery"];
		if (battery) {
			ret.set_float(battery["dischargingTime"]);
		}
		else {
			maybeLoadBatteryManager();
			if (batteryManager) {
				ret.set_float(batteryManager["dischargingTime"]);
			}
			else {
				ret.set_float(Number.POSITIVE_INFINITY);		// not supported/unknown: assume infinite time left
			}
		}
	};
	Exps.prototype.ExecJS = function (ret, js_) {
		if (!eval) {
			ret.set_any(0);
			return;
		}
		var result = 0;
		try {
			result = eval(js_);
		}
		catch (e) {
			if (console && console.error)
				console.error("Error executing Javascript: ", e);
		}
		if (typeof result === "number")
			ret.set_any(result);
		else if (typeof result === "string")
			ret.set_any(result);
		else if (typeof result === "boolean")
			ret.set_any(result ? 1 : 0);
		else
			ret.set_any(0);
	};
	Exps.prototype.ScreenWidth = function (ret) {
		ret.set_int(screen.width);
	};
	Exps.prototype.ScreenHeight = function (ret) {
		ret.set_int(screen.height);
	};
	Exps.prototype.DevicePixelRatio = function (ret) {
		ret.set_float(this.runtime.devicePixelRatio);
	};
	Exps.prototype.WindowInnerWidth = function (ret) {
		ret.set_int(window.innerWidth);
	};
	Exps.prototype.WindowInnerHeight = function (ret) {
		ret.set_int(window.innerHeight);
	};
	Exps.prototype.WindowOuterWidth = function (ret) {
		ret.set_int(window.outerWidth);
	};
	Exps.prototype.WindowOuterHeight = function (ret) {
		ret.set_int(window.outerHeight);
	};
	pluginProto.exps = new Exps();
}());

cr.plugins_.Dictionary = function(runtime)
{
	this.runtime = runtime;
};
(function () {
	var pluginProto = cr.plugins_.Dictionary.prototype;
	pluginProto.Type = function (plugin) {
		this.plugin = plugin;
		this.runtime = plugin.runtime;
	};
	var typeProto = pluginProto.Type.prototype;
	typeProto.onCreate = function () {
	};
	pluginProto.Instance = function (type) {
		this.type = type;
		this.runtime = type.runtime;
	};
	var instanceProto = pluginProto.Instance.prototype;
	instanceProto.onCreate = function () {
		this.dictionary = {};
		this.cur_key = "";		// current key in for-each loop
		this.key_count = 0;
	};
	instanceProto.saveToJSON = function () {
		return this.dictionary;
	};
	instanceProto.loadFromJSON = function (o) {
		this.dictionary = o;
		this.key_count = 0;
		for (var p in this.dictionary) {
			if (this.dictionary.hasOwnProperty(p))
				this.key_count++;
		}
	};

	function Cnds() {
	};
	Cnds.prototype.CompareValue = function (key_, cmp_, value_) {
		return cr.do_cmp(this.dictionary[key_], cmp_, value_);
	};
	Cnds.prototype.ForEachKey = function () {
		var current_event = this.runtime.getCurrentEventStack().current_event;
		for (var p in this.dictionary) {
			if (this.dictionary.hasOwnProperty(p)) {
				this.cur_key = p;
				this.runtime.pushCopySol(current_event.solModifiers);
				current_event.retrigger();
				this.runtime.popSol(current_event.solModifiers);
			}
		}
		this.cur_key = "";
		return false;
	};
	Cnds.prototype.CompareCurrentValue = function (cmp_, value_) {
		return cr.do_cmp(this.dictionary[this.cur_key], cmp_, value_);
	};
	Cnds.prototype.HasKey = function (key_) {
		return this.dictionary.hasOwnProperty(key_);
	};
	Cnds.prototype.IsEmpty = function () {
		return this.key_count === 0;
	};
	pluginProto.cnds = new Cnds();

	function Acts() {
	};
	Acts.prototype.AddKey = function (key_, value_) {
		if (!this.dictionary.hasOwnProperty(key_))
			this.key_count++;
		this.dictionary[key_] = value_;
	};
	Acts.prototype.SetKey = function (key_, value_) {
		if (this.dictionary.hasOwnProperty(key_))
			this.dictionary[key_] = value_;
	};
	Acts.prototype.DeleteKey = function (key_) {
		if (this.dictionary.hasOwnProperty(key_)) {
			delete this.dictionary[key_];
			this.key_count--;
		}
	};
	Acts.prototype.Clear = function () {
		cr.wipe(this.dictionary);		// avoid garbaging
		this.key_count = 0;
	};
	Acts.prototype.JSONLoad = function (json_) {
		var o;
		try {
			o = JSON.parse(json_);
		}
		catch (e) {
			return;
		}
		if (!o["c2dictionary"])		// presumably not a c2dictionary object
			return;
		this.dictionary = o["data"];
		this.key_count = 0;
		for (var p in this.dictionary) {
			if (this.dictionary.hasOwnProperty(p))
				this.key_count++;
		}
	};
	//Acts.prototype.JSONDownload = function (filename)
//	{
//		var a = document.createElement("a");
//		if (typeof a.download === "undefined")
//		{
//			var str = 'data:text/html,' + encodeURIComponent("<p><a download='data.json' href=\"data:application/json,"
//				+ encodeURIComponent(JSON.stringify({
//						"c2dictionary": true,
//						"data": this.dictionary
//					}))
//				+ "\">Download link</a></p>");
//			window.open(str);
//		}
//		else
//		{
//			var body = document.getElementsByTagName("body")[0];
//			a.textContent = filename;
//			a.href = "data:application/json," + encodeURIComponent(JSON.stringify({
//						"c2dictionary": true,
//						"data": this.dictionary
//					}));
//			a.download = filename;
//			body.appendChild(a);
//			var clickEvent = document.createEvent("MouseEvent");
//			clickEvent.initMouseEvent("click", true, true, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
//			a.dispatchEvent(clickEvent);
//			body.removeChild(a);
//		}
//	};
	pluginProto.acts = new Acts();

	function Exps() {
	};
	Exps.prototype.Get = function (ret, key_) {
		if (this.dictionary.hasOwnProperty(key_))
			ret.set_any(this.dictionary[key_]);
		else
			ret.set_int(0);
	};
	Exps.prototype.KeyCount = function (ret) {
		ret.set_int(this.key_count);
	};
	Exps.prototype.CurrentKey = function (ret) {
		ret.set_string(this.cur_key);
	};
	Exps.prototype.CurrentValue = function (ret) {
		if (this.dictionary.hasOwnProperty(this.cur_key))
			ret.set_any(this.dictionary[this.cur_key]);
		else
			ret.set_int(0);
	};
	Exps.prototype.AsJSON = function (ret) {
		ret.set_string(JSON.stringify({
			"c2dictionary": true,
			"data": this.dictionary
		}));
	};
	pluginProto.exps = new Exps();
}());

cr.plugins_.Function = function(runtime)
{
	this.runtime = runtime;
};
(function () {
	var pluginProto = cr.plugins_.Function.prototype;
	pluginProto.Type = function (plugin) {
		this.plugin = plugin;
		this.runtime = plugin.runtime;
	};
	var typeProto = pluginProto.Type.prototype;
	typeProto.onCreate = function () {
	};
	pluginProto.Instance = function (type) {
		this.type = type;
		this.runtime = type.runtime;
	};
	var instanceProto = pluginProto.Instance.prototype;
	var funcStack = [];
	var funcStackPtr = -1;
	var isInPreview = false;	// set in onCreate
	function FuncStackEntry() {
		this.name = "";
		this.retVal = 0;
		this.params = [];
	};

	function pushFuncStack() {
		funcStackPtr++;
		if (funcStackPtr === funcStack.length)
			funcStack.push(new FuncStackEntry());
		return funcStack[funcStackPtr];
	};

	function getCurrentFuncStack() {
		if (funcStackPtr < 0)
			return null;
		return funcStack[funcStackPtr];
	};

	function getOneAboveFuncStack() {
		if (!funcStack.length)
			return null;
		var i = funcStackPtr + 1;
		if (i >= funcStack.length)
			i = funcStack.length - 1;
		return funcStack[i];
	};

	function popFuncStack() {
		;
		funcStackPtr--;
	};
	instanceProto.onCreate = function () {
		isInPreview = (typeof cr_is_preview !== "undefined");
		var self = this;
		window["c2_callFunction"] = function (name_, params_) {
			var i, len, v;
			var fs = pushFuncStack();
			fs.name = name_.toLowerCase();
			fs.retVal = 0;
			if (params_) {
				fs.params.length = params_.length;
				for (i = 0, len = params_.length; i < len; ++i) {
					v = params_[i];
					if (typeof v === "number" || typeof v === "string")
						fs.params[i] = v;
					else if (typeof v === "boolean")
						fs.params[i] = (v ? 1 : 0);
					else
						fs.params[i] = 0;
				}
			}
			else {
				cr.clearArray(fs.params);
			}
			self.runtime.trigger(cr.plugins_.Function.prototype.cnds.OnFunction, self, fs.name);
			popFuncStack();
			return fs.retVal;
		};
	};

	function Cnds() {
	};
	Cnds.prototype.OnFunction = function (name_) {
		var fs = getCurrentFuncStack();
		if (!fs)
			return false;
		return cr.equals_nocase(name_, fs.name);
	};
	Cnds.prototype.CompareParam = function (index_, cmp_, value_) {
		var fs = getCurrentFuncStack();
		if (!fs)
			return false;
		index_ = cr.floor(index_);
		if (index_ < 0 || index_ >= fs.params.length)
			return false;
		return cr.do_cmp(fs.params[index_], cmp_, value_);
	};
	pluginProto.cnds = new Cnds();

	function Acts() {
	};
	Acts.prototype.CallFunction = function (name_, params_) {
		var fs = pushFuncStack();
		fs.name = name_.toLowerCase();
		fs.retVal = 0;
		cr.shallowAssignArray(fs.params, params_);
		var ran = this.runtime.trigger(cr.plugins_.Function.prototype.cnds.OnFunction, this, fs.name);
		if (isInPreview && !ran) {
			;
		}
		popFuncStack();
	};
	Acts.prototype.SetReturnValue = function (value_) {
		var fs = getCurrentFuncStack();
		if (fs)
			fs.retVal = value_;
		else
			;
	};
	Acts.prototype.CallExpression = function (unused) {
	};
	pluginProto.acts = new Acts();

	function Exps() {
	};
	Exps.prototype.ReturnValue = function (ret) {
		var fs = getOneAboveFuncStack();
		if (fs)
			ret.set_any(fs.retVal);
		else
			ret.set_int(0);
	};
	Exps.prototype.ParamCount = function (ret) {
		var fs = getCurrentFuncStack();
		if (fs)
			ret.set_int(fs.params.length);
		else {
			;
			ret.set_int(0);
		}
	};
	Exps.prototype.Param = function (ret, index_) {
		index_ = cr.floor(index_);
		var fs = getCurrentFuncStack();
		if (fs) {
			if (index_ >= 0 && index_ < fs.params.length) {
				ret.set_any(fs.params[index_]);
			}
			else {
				;
				ret.set_int(0);
			}
		}
		else {
			;
			ret.set_int(0);
		}
	};
	Exps.prototype.Call = function (ret, name_) {
		var fs = pushFuncStack();
		fs.name = name_.toLowerCase();
		fs.retVal = 0;
		cr.clearArray(fs.params);
		var i, len;
		for (i = 2, len = arguments.length; i < len; i++)
			fs.params.push(arguments[i]);
		var ran = this.runtime.trigger(cr.plugins_.Function.prototype.cnds.OnFunction, this, fs.name);
		if (isInPreview && !ran) {
			;
		}
		popFuncStack();
		ret.set_any(fs.retVal);
	};
	pluginProto.exps = new Exps();
}());

cr.plugins_.Keyboard = function(runtime)
{
	this.runtime = runtime;
};
(function () {
	var pluginProto = cr.plugins_.Keyboard.prototype;
	pluginProto.Type = function (plugin) {
		this.plugin = plugin;
		this.runtime = plugin.runtime;
	};
	var typeProto = pluginProto.Type.prototype;
	typeProto.onCreate = function () {
	};
	pluginProto.Instance = function (type) {
		this.type = type;
		this.runtime = type.runtime;
		this.keyMap = new Array(256);	// stores key up/down state
		this.usedKeys = new Array(256);
		this.triggerKey = 0;
	};
	var instanceProto = pluginProto.Instance.prototype;
	instanceProto.onCreate = function () {
		var self = this;
		if (!this.runtime.isDomFree) {
			document.addEventListener("keydown", function (info) {
				self.onKeyDown(info);
			}, false);
			document.addEventListener("keyup", function (info) {
				self.onKeyUp(info);
			}, false);
			// $(document).keydown(
			// 	function(info) {
			// 		self.onKeyDown(info);
			// 	}
			// );
			// $(document).keyup(
			// 	function(info) {
			// 		self.onKeyUp(info);
			// 	}
			// );
		}
	};
	var keysToBlockWhenFramed = [32, 33, 34, 35, 36, 37, 38, 39, 40, 44];
	instanceProto.onKeyDown = function (info) {
		var alreadyPreventedDefault = false;
		if (window != window.top && keysToBlockWhenFramed.indexOf(info.which) > -1) {
			info.preventDefault();
			alreadyPreventedDefault = true;
			info.stopPropagation();
		}
		if (this.keyMap[info.which]) {
			if (this.usedKeys[info.which] && !alreadyPreventedDefault)
				info.preventDefault();
			return;
		}
		this.keyMap[info.which] = true;
		this.triggerKey = info.which;
		this.runtime.isInUserInputEvent = true;
		this.runtime.trigger(cr.plugins_.Keyboard.prototype.cnds.OnAnyKey, this);
		var eventRan = this.runtime.trigger(cr.plugins_.Keyboard.prototype.cnds.OnKey, this);
		var eventRan2 = this.runtime.trigger(cr.plugins_.Keyboard.prototype.cnds.OnKeyCode, this);
		this.runtime.isInUserInputEvent = false;
		if (eventRan || eventRan2) {
			this.usedKeys[info.which] = true;
			if (!alreadyPreventedDefault)
				info.preventDefault();
		}
	};
	instanceProto.onKeyUp = function (info) {
		this.keyMap[info.which] = false;
		this.triggerKey = info.which;
		this.runtime.isInUserInputEvent = true;
		this.runtime.trigger(cr.plugins_.Keyboard.prototype.cnds.OnAnyKeyReleased, this);
		var eventRan = this.runtime.trigger(cr.plugins_.Keyboard.prototype.cnds.OnKeyReleased, this);
		var eventRan2 = this.runtime.trigger(cr.plugins_.Keyboard.prototype.cnds.OnKeyCodeReleased, this);
		this.runtime.isInUserInputEvent = false;
		if (eventRan || eventRan2 || this.usedKeys[info.which]) {
			this.usedKeys[info.which] = true;
			info.preventDefault();
		}
	};
	instanceProto.onWindowBlur = function () {
		var i;
		for (i = 0; i < 256; ++i) {
			if (!this.keyMap[i])
				continue;		// key already up
			this.keyMap[i] = false;
			this.triggerKey = i;
			this.runtime.trigger(cr.plugins_.Keyboard.prototype.cnds.OnAnyKeyReleased, this);
			var eventRan = this.runtime.trigger(cr.plugins_.Keyboard.prototype.cnds.OnKeyReleased, this);
			var eventRan2 = this.runtime.trigger(cr.plugins_.Keyboard.prototype.cnds.OnKeyCodeReleased, this);
			if (eventRan || eventRan2)
				this.usedKeys[i] = true;
		}
	};
	instanceProto.saveToJSON = function () {
		return {"triggerKey": this.triggerKey};
	};
	instanceProto.loadFromJSON = function (o) {
		this.triggerKey = o["triggerKey"];
	};

	function Cnds() {
	};
	Cnds.prototype.IsKeyDown = function (key) {
		return this.keyMap[key];
	};
	Cnds.prototype.OnKey = function (key) {
		return (key === this.triggerKey);
	};
	Cnds.prototype.OnAnyKey = function (key) {
		return true;
	};
	Cnds.prototype.OnAnyKeyReleased = function (key) {
		return true;
	};
	Cnds.prototype.OnKeyReleased = function (key) {
		return (key === this.triggerKey);
	};
	Cnds.prototype.IsKeyCodeDown = function (key) {
		key = Math.floor(key);
		if (key < 0 || key >= this.keyMap.length)
			return false;
		return this.keyMap[key];
	};
	Cnds.prototype.OnKeyCode = function (key) {
		return (key === this.triggerKey);
	};
	Cnds.prototype.OnKeyCodeReleased = function (key) {
		return (key === this.triggerKey);
	};
	pluginProto.cnds = new Cnds();

	function Acts() {
	};
	pluginProto.acts = new Acts();

	function Exps() {
	};
	Exps.prototype.LastKeyCode = function (ret) {
		ret.set_int(this.triggerKey);
	};

	function fixedStringFromCharCode(kc) {
		kc = Math.floor(kc);
		switch (kc) {
			case 8:
				return "backspace";
			case 9:
				return "tab";
			case 13:
				return "enter";
			case 16:
				return "shift";
			case 17:
				return "control";
			case 18:
				return "alt";
			case 19:
				return "pause";
			case 20:
				return "capslock";
			case 27:
				return "esc";
			case 33:
				return "pageup";
			case 34:
				return "pagedown";
			case 35:
				return "end";
			case 36:
				return "home";
			case 37:
				return "←";
			case 38:
				return "↑";
			case 39:
				return "→";
			case 40:
				return "↓";
			case 45:
				return "insert";
			case 46:
				return "del";
			case 91:
				return "left window key";
			case 92:
				return "right window key";
			case 93:
				return "select";
			case 96:
				return "numpad 0";
			case 97:
				return "numpad 1";
			case 98:
				return "numpad 2";
			case 99:
				return "numpad 3";
			case 100:
				return "numpad 4";
			case 101:
				return "numpad 5";
			case 102:
				return "numpad 6";
			case 103:
				return "numpad 7";
			case 104:
				return "numpad 8";
			case 105:
				return "numpad 9";
			case 106:
				return "numpad *";
			case 107:
				return "numpad +";
			case 109:
				return "numpad -";
			case 110:
				return "numpad .";
			case 111:
				return "numpad /";
			case 112:
				return "F1";
			case 113:
				return "F2";
			case 114:
				return "F3";
			case 115:
				return "F4";
			case 116:
				return "F5";
			case 117:
				return "F6";
			case 118:
				return "F7";
			case 119:
				return "F8";
			case 120:
				return "F9";
			case 121:
				return "F10";
			case 122:
				return "F11";
			case 123:
				return "F12";
			case 144:
				return "numlock";
			case 145:
				return "scroll lock";
			case 186:
				return ";";
			case 187:
				return "=";
			case 188:
				return ",";
			case 189:
				return "-";
			case 190:
				return ".";
			case 191:
				return "/";
			case 192:
				return "'";
			case 219:
				return "[";
			case 220:
				return "\\";
			case 221:
				return "]";
			case 222:
				return "#";
			case 223:
				return "`";
			default:
				return String.fromCharCode(kc);
		}
	};
	Exps.prototype.StringFromKeyCode = function (ret, kc) {
		ret.set_string(fixedStringFromCharCode(kc));
	};
	pluginProto.exps = new Exps();
}());
var localForageInitFailed = false;
cr.plugins_.LocalStorage = function(runtime)
{
	this.runtime = runtime;
};
(function ()
{
	var currentKey = "";
	var lastValue = "";
	var keyNamesList = [];
	var errorMessage = "";
	function getErrorString(err)
	{
		if (!err)
			return "unknown error";
		else if (typeof err === "string")
			return err;
		else if (typeof err.message === "string")
			return err.message;
		else if (typeof err.name === "string")
			return err.name;
		else if (typeof err.data === "string")
			return err.data;
		else
			return "unknown error";
	};
	function TriggerStorageError(self, msg)
	{
		errorMessage = msg;
		self.runtime.trigger(cr.plugins_.LocalStorage.prototype.cnds.OnError, self);
	};
	var prefix = "";
	var is_arcade = (typeof window["is_scirra_arcade"] !== "undefined");
	if (is_arcade)
		prefix = "sa" + window["scirra_arcade_id"] + "_";
	function hasRequiredPrefix(key)
	{
		if (!prefix)
			return true;
		return key.substr(0, prefix.length) === prefix;
	};
	function removePrefix(key)
	{
		if (!prefix)
			return key;
		if (hasRequiredPrefix(key))
			return key.substr(prefix.length);
	};
	var pluginProto = cr.plugins_.LocalStorage.prototype;
	pluginProto.Type = function(plugin)
	{
		this.plugin = plugin;
		this.runtime = plugin.runtime;
	};
	var typeProto = pluginProto.Type.prototype;
	typeProto.onCreate = function()
	{
	};
	pluginProto.Instance = function(type)
	{
		this.type = type;
		this.runtime = type.runtime;
	};
	var instanceProto = pluginProto.Instance.prototype;
	instanceProto.onCreate = function()
	{
		this.pendingSets = 0;		// number of pending 'Set item' actions
		this.pendingGets = 0;		// number of pending 'Get item' actions
	};
	instanceProto.onDestroy = function ()
	{
	};
	instanceProto.saveToJSON = function ()
	{
		return {
		};
	};
	instanceProto.loadFromJSON = function (o)
	{
	};
	var debugDataChanged = true;
	function Cnds() {};
	Cnds.prototype.OnItemSet = function (key)
	{
		return currentKey === key;
	};
	Cnds.prototype.OnAnyItemSet = function ()
	{
		return true;
	};
	Cnds.prototype.OnItemGet = function (key)
	{
		return currentKey === key;
	};
	Cnds.prototype.OnAnyItemGet = function ()
	{
		return true;
	};
	Cnds.prototype.OnItemRemoved = function (key)
	{
		return currentKey === key;
	};
	Cnds.prototype.OnAnyItemRemoved = function ()
	{
		return true;
	};
	Cnds.prototype.OnCleared = function ()
	{
		return true;
	};
	Cnds.prototype.OnAllKeyNamesLoaded = function ()
	{
		return true;
	};
	Cnds.prototype.OnError = function ()
	{
		return true;
	};
	Cnds.prototype.OnItemExists = function (key)
	{
		return currentKey === key;
	};
	Cnds.prototype.OnItemMissing = function (key)
	{
		return currentKey === key;
	};
	Cnds.prototype.CompareKey = function (cmp, key)
	{
		return cr.do_cmp(currentKey, cmp, key);
	};
	Cnds.prototype.CompareValue = function (cmp, v)
	{
		return cr.do_cmp(lastValue, cmp, v);
	};
	Cnds.prototype.IsProcessingSets = function ()
	{
		return this.pendingSets > 0;
	};
	Cnds.prototype.IsProcessingGets = function ()
	{
		return this.pendingGets > 0;
	};
	Cnds.prototype.OnAllSetsComplete = function ()
	{
		return true;
	};
	Cnds.prototype.OnAllGetsComplete = function ()
	{
		return true;
	};
	pluginProto.cnds = new Cnds();
	function Acts() {};
	Acts.prototype.SetItem = function (keyNoPrefix, value)
	{
		if (localForageInitFailed)
		{
			TriggerStorageError(this, "storage failed to initialise - may be disabled in browser settings");
			return;
		}
		var keyPrefix = prefix + keyNoPrefix;
		this.pendingSets++;
		var self = this;
		localforage["setItem"](keyPrefix, value, function (err, valueSet)
		{
			debugDataChanged = true;
			self.pendingSets--;
			if (err)
			{
				errorMessage = getErrorString(err);
				self.runtime.trigger(cr.plugins_.LocalStorage.prototype.cnds.OnError, self);
			}
			else
			{
				currentKey = keyNoPrefix;
				lastValue = valueSet;
				self.runtime.trigger(cr.plugins_.LocalStorage.prototype.cnds.OnAnyItemSet, self);
				self.runtime.trigger(cr.plugins_.LocalStorage.prototype.cnds.OnItemSet, self);
				currentKey = "";
				lastValue = "";
			}
			if (self.pendingSets === 0)
			{
				self.runtime.trigger(cr.plugins_.LocalStorage.prototype.cnds.OnAllSetsComplete, self);
			}
		});
	};
	Acts.prototype.GetItem = function (keyNoPrefix)
	{
		if (localForageInitFailed)
		{
			TriggerStorageError(this, "storage failed to initialise - may be disabled in browser settings");
			return;
		}
		var keyPrefix = prefix + keyNoPrefix;
		this.pendingGets++;
		var self = this;
		localforage["getItem"](keyPrefix, function (err, value)
		{
			self.pendingGets--;
			if (err)
			{
				errorMessage = getErrorString(err);
				self.runtime.trigger(cr.plugins_.LocalStorage.prototype.cnds.OnError, self);
			}
			else
			{
				currentKey = keyNoPrefix;
				lastValue = value;
				if (typeof lastValue === "undefined" || lastValue === null)
					lastValue = "";
				self.runtime.trigger(cr.plugins_.LocalStorage.prototype.cnds.OnAnyItemGet, self);
				self.runtime.trigger(cr.plugins_.LocalStorage.prototype.cnds.OnItemGet, self);
				currentKey = "";
				lastValue = "";
			}
			if (self.pendingGets === 0)
			{
				self.runtime.trigger(cr.plugins_.LocalStorage.prototype.cnds.OnAllGetsComplete, self);
			}
		});
	}
	pluginProto.acts = new Acts();
	function Exps() {};
	Exps.prototype.ItemValue = function (ret)
	{
		ret.set_any(lastValue);
	};
	Exps.prototype.Key = function (ret)
	{
		ret.set_string(currentKey);
	};
	Exps.prototype.KeyCount = function (ret)
	{
		ret.set_int(keyNamesList.length);
	};
	Exps.prototype.KeyAt = function (ret, i)
	{
		i = Math.floor(i);
		if (i < 0 || i >= keyNamesList.length)
		{
			ret.set_string("");
			return;
		}
		ret.set_string(keyNamesList[i]);
	};
	Exps.prototype.ErrorMessage = function (ret)
	{
		ret.set_string(errorMessage);
	};
	pluginProto.exps = new Exps();
}())
cr.plugins_.MM_Preloader = function(runtime)
{
	this.runtime = runtime;
};
(function () {
	var preloader = {
		items: [],
		itemsCompleted: 0,
		itemsCount: 0,
		isLazyPreloading: false,
		lazyInterval: 0
	};
	var MoMod = null;
	var MM_Debugger = null;
	var THIS_TAG = "MM_Preloader";
	var thisInstance = null;
	var objectPreloadId = 0;
	var OBJECT_PRELOAD_KEY = "mm_preloader_object_preload_";
	var objectPreloadQueue = [];
	var isPreloadingObjects = false;
	var tickForNextObjectPreloadTrigger = 0;
	var intervalObject = null;
	var objectsPreloadingState = 0;
	var isC2EnginePreloaderAdded = false;
	var C2_ENGINE_PRELOADER_KEY = "mm_preloader_c2_engine_";
	var spriterInterval = null;
	var spriterInst = null;
	var spriterIndex = null;
	var pluginProto = cr.plugins_.MM_Preloader.prototype;
	pluginProto.Type = function (plugin) {
		this.plugin = plugin;
		this.runtime = plugin.runtime;
	};
	var typeProto = pluginProto.Type.prototype;
	typeProto.onCreate = function () {
	};
	pluginProto.Instance = function (type) {
		this.type = type;
		this.runtime = type.runtime;
	};
	var instanceProto = pluginProto.Instance.prototype;
	instanceProto.onCreate = function () {
		thisInstance = this;
		stabilizer.isEnabled = !!this.properties[1];
		stabilizer.maxChecks = Math.max(this.properties[2], 1);
		stabilizer.frequency = this.properties[3];
		stabilizer.minFps = Math.max(this.properties[4], 1);
		stabilizer.confirmations = Math.max(this.properties[5], 1);
		if (typeof cr.plugins_.MoMod !== 'undefined' && cr.plugins_.MoMod) {
			MoMod = cr.plugins_.MoMod.prototype.shared;
		}
		if (typeof cr.plugins_.MM_Debugger !== 'undefined' && cr.plugins_.MM_Debugger) {
			MM_Debugger = cr.plugins_.MM_Debugger.prototype.shared;
		}
	};
	instanceProto.onDestroy = function () {
	};

	function Cnds() {
	};
	/**
	 * @returns {boolean}
	 */
	Cnds.prototype.OnProgress = function () {
		return true;
	};
	/**
	 * @returns {boolean}
	 */
	Cnds.prototype.OnCompleted = function () {
		preloader.items = [];
		preloader.itemsCompleted = 0;
		preloader.itemsCount = 0;
		objectPreloadId = 0;
		objectPreloadQueue = [];
		isPreloadingObjects = false;
		tickForNextObjectPreloadTrigger = 0;
		intervalObject = null;
		objectsPreloadingState = 0;
		isC2EnginePreloaderAdded = false;
		if (stabilizer.isEnabled) {
			clearTimeout(stabilizer.instance.timerInstance);
			stabilizer.instance.currentCheck = 0;
			stabilizer.instance.currentConfirmations = 0;
			stabilizer.instance.timerInstance = null;
		}
		return true;
	};
	/**
	 * @returns {boolean}
	 */
	Cnds.prototype.HasItem = function (key_) {
		return (typeof preloader.items[key_.toLowerCase()] !== 'undefined' && preloader.items[key_.toLowerCase()]);
	};
	pluginProto.cnds = new Cnds();

	function Acts() {
	};
	Acts.prototype.AddItem = function (key_, trigger_, dependency_) {
		addPreloaderItem(key_, trigger_, dependency_);
	};
	Acts.prototype.SetItemState = function (key_, newState_) {
		setItemState(key_, newState_, this);
	};
	Acts.prototype.Start = function () {
		preloader.isLazyPreloading = false;
		if (preloader.itemsCount === 0 && stabilizer.isEnabled === false) {
			preloaderLog("[Preloader]: Cannot start Preloader, the list is empty.", this);
			return;
		}
		if (stabilizer.isEnabled) {
			var key;
			var dependencyList = [];
			for (key in preloader.items) {
				if (preloader.items.hasOwnProperty(key)) {
					dependencyList.push(key);
				}
			}
			for (key in preloader.items) {
				if (preloader.items.hasOwnProperty(key) && preloader.items[key].dependency == "_last") {
					var localDependencyList = dependencyList;
					localDependencyList.splice(dependencyList.indexOf(key), 1);
					preloader.items[key].dependency = localDependencyList.join();
				}
			}
			addPreloaderItem("Stabilizer", "true", "_last");
		}
		preloaderProcessItems(this);
	};
	Acts.prototype.StartLazy = function (lazyInterval_) {
		if (preloader.itemsCount === 0) {
			preloaderLog("[Preloader]: Cannot start Preloader, the list is empty.", this);
			return;
		}
		preloader.isLazyPreloading = true;
		preloader.lazyInterval = lazyInterval_;
		preloaderProcessItems(this);
	};
	Acts.prototype.StabilizerSetState = function (state_) {
		stabilizer.isEnabled = !!state_;
	};
	Acts.prototype.PreloadObject = function (obj_) {
		if (!obj_) return;
		addObjectToPreloader(obj_);
	};
	Acts.prototype.AddFromLayoutByName = function (layoutName_) {
		var l, layout;
		for (l in this.runtime.layouts) {
			if (this.runtime.layouts.hasOwnProperty(l) && cr.equals_nocase(l, layoutName_)) {
				layout = this.runtime.layouts[l];
				break;
			}
		}
		if (!layout) {
			preloaderLog("[Preloader ERROR]: Cannot load objects from layout \"" + layoutName_ + "\" because such layout does not exist.", this);
			return;
		}
		addObjectFromLayout(layout);
	};
	Acts.prototype.AddFromLayout = function (layout) {
		if (!layout) return;
		addObjectFromLayout(layout);
	};
	Acts.prototype.AddC2EngineProgress = function () {
		isC2EnginePreloaderAdded = true;
		addPreloaderItem(C2_ENGINE_PRELOADER_KEY, "", "");
	};
	pluginProto.acts = new Acts();

	function Exps() {
	};
	Exps.prototype.Progress = function (ret) {
		var generalPreloadProgress = Math.floor((preloader.itemsCompleted / preloader.itemsCount) * 10000) / 100;
		var detailedPreloadProgress = 0;
		var unitValue = 1 / preloader.itemsCount;
		var key;
		for (key in preloader.items) {
			if (preloader.items.hasOwnProperty(key) && preloader.items[key].currentState < 100 && preloader.items[key].currentState > 0) {
				detailedPreloadProgress += unitValue * (preloader.items[key].currentState / 100)
			}
		}
		detailedPreloadProgress = Math.floor(detailedPreloadProgress * 10000) / 100;
		ret.set_float(Math.floor((generalPreloadProgress + detailedPreloadProgress) * 100) / 100);
	};
	Exps.prototype.ItemProgress = function (ret, key_) {
		key_ = key_.toLowerCase();
		if (typeof preloader.items[key_] === 'undefined' || !preloader.items[key_]) {
			preloaderLog("[Preloader ERROR]: Cannot get state of \"" + key_ + "\" item, because such item does not exist on preloader list.", this);
			ret.set_int(0);
			return;
		}
		ret.set_float(Math.floor(preloader.items[key_].currentState * 100) / 100);
	};
	Exps.prototype.ItemsCount = function (ret) {
		ret.set_int(preloader.itemsCount);
	};
	Exps.prototype.ObjectsProgress = function (ret) {
		if (objectPreloadQueue.length === 0) {
			preloaderLog("[Preloader ERROR]: Cannot get state of preloading objects, because none object has been added to the preloader list.", this);
			ret.set_int(0);
			return;
		}
		ret.set_float(Math.floor(objectsPreloadingState * 100) / 100);
	};
	Exps.prototype.C2EngineProgress = function (ret) {
		if (typeof preloader.items[C2_ENGINE_PRELOADER_KEY] === 'undefined' || !preloader.items[C2_ENGINE_PRELOADER_KEY]) {
			preloaderLog("[Preloader ERROR]: Cannot get state of \"C2 Engine\" item, because it does not exist on preloader list.", this);
			ret.set_int(0);
			return;
		}
		ret.set_float(Math.floor(preloader.items[C2_ENGINE_PRELOADER_KEY].currentState * 100) / 100);
	};
	pluginProto.exps = new Exps();
	var stabilizer =
		{
			isEnabled: true,
			maxChecks: 0,
			frequency: 0,
			minFps: 60,
			confirmations: 1,
			instance: {
				currentCheck: 0,
				currentConfirmations: 0,
				timerInstance: null,
				currentDis: null
			},
			checkFunction: function () {
				if (stabilizer.maxChecks > stabilizer.instance.currentCheck) {
					++stabilizer.instance.currentCheck;
					if (stabilizer.minFps <= thisInstance.runtime.fps) {
						++stabilizer.instance.currentConfirmations;
						if (stabilizer.instance.currentConfirmations >= stabilizer.confirmations) {
							setItemState("Stabilizer", 100, stabilizer.instance.currentDis);
							return;
						}
					}
					var currentState = (stabilizer.instance.currentCheck / stabilizer.maxChecks) * 100;
					setItemState("Stabilizer", currentState, stabilizer.instance.currentDis);
					if (currentState < 100) {
						stabilizer.instance.timerInstance = setTimeout(stabilizer.checkFunction, stabilizer.frequency * 1000);
					}
				}
				else {
					setItemState("Stabilizer", 100, stabilizer.instance.currentDis);
				}
			}
		};

	function addPreloaderItem(key_, trigger_, dependency_) {
		key_ = key_.toLowerCase();
		if (typeof preloader.items[key_] !== 'undefined' && preloader.items[key_]) {
			preloaderLog("[Preloader]: Duplicate entry \"" + key_ + "\". This item already exists on preloader list.", this);
			return;
		}
		preloader.items[key_] = {
			trigger: trigger_.toLowerCase(),
			dependency: dependency_.toLowerCase(),
			currentState: 0,
			isProcessing: !trigger_
		};
		++preloader.itemsCount;
	}

	function preloaderProcessItems(dis_) {
		if (isC2EnginePreloaderAdded) {
			if (!intervalObject) {
				intervalObject = setInterval(function () {
					var state = dis_.runtime.loadingprogress * 100;
					if (state == 100) {
						clearInterval(intervalObject);
						isC2EnginePreloaderAdded = false;
					}
					setItemState(C2_ENGINE_PRELOADER_KEY, state, dis_);
				}, 50);
			}
			return;
		}
		var key;
		for (key in preloader.items) {
			if (!preloader.items.hasOwnProperty(key) || preloader.items[key].currentState === 100 || preloader.items[key].isProcessing === true) continue;
			if (!preloader.items[key].dependency) {
				preloaderTriggerItem(key);
			}
			else if (preloader.items[key].dependency === "_last") {
				if (preloader.itemsCompleted === preloader.itemsCount - 1) {
					if (stabilizer.isEnabled) {
						preloader.items[key].isProcessing = true;
						stabilizer.instance.currentDis = dis_;
						stabilizer.instance.timerInstance = setTimeout(stabilizer.checkFunction, stabilizer.frequency * 1000);
					}
					else {
						preloaderTriggerItem(key);
					}
				}
			}
			else if (preloader.items[key].dependency === OBJECT_PRELOAD_KEY) {
				if (isPreloadingObjects === false) {
					isPreloadingObjects = true;
					triggerObjectsPreloadingQueue(dis_);
				}
			}
			else {
				var dependencies = preloader.items[key].dependency.split(",");
				var allDependenciesReady = true;
				var i;
				for (i = 0; i < dependencies.length; i++) {
					if (!preloader.items[dependencies[i]]) {
						preloaderLog("[Preloader ERROR]: item \"" + key + "\" has dependency \"" + dependencies[i] + "\" but \"" + dependencies[i] + "\" item does not exist in preloader's list.", dis_);
						return;
					}
					if (preloader.items[dependencies[i]].currentState < 100) {
						allDependenciesReady = false;
						break;
					}
				}
				if (allDependenciesReady) {
					preloaderTriggerItem(key);
				}
			}
			if (preloader.isLazyPreloading) {
				return;
			}
		}
	}

	function addObjectToPreloader(obj_) {
		/*
		 deadCache seems to be unpredictable and can't rely on it when it comes to sprites.
		 Also it isn't the factor for texture in the memory,
		 meaning that it happens that even thoug there's deadCache available, the texture isn't loaded.
		 if(obj_.deadCache.length > 0 || obj_.instances.length > 0)
		 {
		 return;
		 }
		 */
		var itemKey = OBJECT_PRELOAD_KEY + objectPreloadId;
		objectPreloadQueue.push({
			object: obj_,
			key: itemKey,
			isPreloaded: false
		});
		addPreloaderItem(itemKey, "automatic", OBJECT_PRELOAD_KEY);
		++objectPreloadId;
	}

	function addObjectFromLayout(layout) {
		var i;
		for (i = 0; i < layout.initial_types.length; i++) {
			if (typeof layout.initial_types[i].plugin !== 'object') continue;
			if (cr.plugins_.Sprite && layout.initial_types[i].plugin instanceof cr.plugins_.Sprite) {
				if (layout.initial_types[i].has_loaded_textures) continue;
			}
			if (cr.plugins_.TiledBg && layout.initial_types[i].plugin instanceof cr.plugins_.TiledBg) {
				if (layout.initial_types[i].webGL_texture) continue;
			}
			if (cr.plugins_.Tilemap && layout.initial_types[i].plugin instanceof cr.plugins_.Tilemap) {
				if (layout.initial_types[i].cut_tiles_valid) continue;
			}
			if ((cr.plugins_.SpriteFontPlus && layout.initial_types[i].plugin instanceof cr.plugins_.SpriteFontPlus)
				|| (cr.plugins_.Spritefont2 && layout.initial_types[i].plugin instanceof cr.plugins_.Spritefont2)) {
				if (layout.initial_types[i].webGL_texture) continue;
			}
			if (cr.plugins_.Spriter && layout.initial_types[i].plugin instanceof cr.plugins_.Spriter) {
				if (layout.initial_types[i].deadCache.length > 0 /* || layout.initial_types[i].instances.length > 0 */) continue;
			}
			addObjectToPreloader(layout.initial_types[i]);
		}
	}

	function triggerObjectsPreloadingQueue(dis_) {
		if (intervalObject) {
			clearInterval(intervalObject);
		}
		if (spriterInterval) return;
		var i;
		var isLastItem = false;
		for (i = 0; i < objectPreloadQueue.length; i++) {
			if (!objectPreloadQueue[i].isPreloaded) {
				isLastItem = i === objectPreloadQueue.length - 1;
				var inst = dis_.runtime.createInstance(objectPreloadQueue[i].object, dis_.runtime.running_layout.layers[0], 0, 0);
				if (inst) {
					if (cr.plugins_.Spriter && inst.type.plugin instanceof cr.plugins_.Spriter) {
						spriterInst = inst;
						spriterIndex = i;
						spriterInterval = setInterval(function () {
							if (spriterInst.entities) {
								clearInterval(spriterInterval);
								spriterInterval = null;
								objectPreloadQueue[spriterIndex].isPreloaded = true;
								objectsPreloadingState = ((spriterIndex + 1) / objectPreloadQueue.length * 10000) / 100;
								setItemState(objectPreloadQueue[spriterIndex].key, 100, dis_);
								dis_.runtime.DestroyInstance(spriterInst);
							}
						}, 16);
					}
					else {
						objectPreloadQueue[i].isPreloaded = true;
						objectsPreloadingState = ((i + 1) / objectPreloadQueue.length * 10000) / 100;
						setItemState(objectPreloadQueue[i].key, 100, dis_);
						dis_.runtime.DestroyInstance(inst);
					}
				}
				break;
			}
		}
		if (!isLastItem) {
			tickForNextObjectPreloadTrigger = dis_.runtime.tickcount + 2;
			intervalObject = setInterval(function () {
				if (tickForNextObjectPreloadTrigger < dis_.runtime.tickcount) {
					triggerObjectsPreloadingQueue(dis_)
				}
			}, preloader.isLazyPreloading ? preloader.lazyInterval * 1000 : 50);
		}
	}

	function setItemState(key_, newState_, dis_) {
		key_ = key_.toLowerCase();
		if (typeof preloader.items[key_] === 'undefined' || !preloader.items[key_]) {
			preloaderLog("[Preloader ERROR]: Cannot update \"" + key_ + "\" item, because such item does not exist on preloader list.", dis_);
			return;
		}
		preloader.items[key_].currentState = cr.clamp(newState_, 0, 100);
		if (preloader.items[key_].currentState === 100) {
			++preloader.itemsCompleted;
		}
		dis_.runtime.trigger(cr.plugins_.MM_Preloader.prototype.cnds.OnProgress, dis_);
		if (preloader.itemsCompleted === preloader.itemsCount) {
			dis_.runtime.trigger(cr.plugins_.MM_Preloader.prototype.cnds.OnCompleted, dis_);
		}
		else {
			if (!isC2EnginePreloaderAdded) {
				if (preloader.isLazyPreloading && preloader.items[key_].currentState === 100) {
					setTimeout(function () {
						preloaderProcessItems(dis_);
					}, preloader.lazyInterval * 1000);
				}
				else {
					preloaderProcessItems(dis_);
				}
			}
		}
	}

	function preloaderTriggerItem(key_) {
		if (MoMod && preloader.items[key_].trigger.indexOf(" >>> ") !== -1) {
			var moduleName = preloader.items[key_].trigger.substring(0, preloader.items[key_].trigger.indexOf(" >>> "));
			var eventName = preloader.items[key_].trigger.substring(preloader.items[key_].trigger.indexOf(" >>> ") + 5, preloader.items[key_].trigger.length);
			preloader.items[key_].isProcessing = true;
			MoMod.dispatchEvent(moduleName, eventName, []);
		}
		else if (c2_callFunction) {
			preloader.items[key_].isProcessing = true;
			c2_callFunction(preloader.items[key_].trigger, []);
		}
	}

	function preloaderLog(message_, dis_) {
		MM_Debugger ? MM_Debugger.log(0, message_, THIS_TAG, dis_) : console.log(message_);
	}
}());

cr.plugins_.Particles = function(runtime)
{
	this.runtime = runtime;
};
(function () {
	var pluginProto = cr.plugins_.Particles.prototype;
	pluginProto.Type = function (plugin) {
		this.plugin = plugin;
		this.runtime = plugin.runtime;
	};
	var typeProto = pluginProto.Type.prototype;
	typeProto.onCreate = function () {
		if (this.is_family)
			return;
		this.texture_img = new Image();
		this.texture_img.cr_filesize = this.texture_filesize;
		this.webGL_texture = null;
		this.runtime.waitForImageLoad(this.texture_img, this.texture_file);
	};
	typeProto.onLostWebGLContext = function () {
		if (this.is_family)
			return;
		this.webGL_texture = null;
	};
	typeProto.onRestoreWebGLContext = function () {
		if (this.is_family || !this.instances.length)
			return;
		if (!this.webGL_texture) {
			this.webGL_texture = this.runtime.glwrap.loadTexture(this.texture_img, true, this.runtime.linearSampling, this.texture_pixelformat);
		}
	};
	typeProto.loadTextures = function () {
		if (this.is_family || this.webGL_texture || !this.runtime.glwrap)
			return;
		this.webGL_texture = this.runtime.glwrap.loadTexture(this.texture_img, true, this.runtime.linearSampling, this.texture_pixelformat);
	};
	typeProto.unloadTextures = function () {
		if (this.is_family || this.instances.length || !this.webGL_texture)
			return;
		this.runtime.glwrap.deleteTexture(this.webGL_texture);
		this.webGL_texture = null;
	};
	typeProto.preloadCanvas2D = function (ctx) {
		ctx.drawImage(this.texture_img, 0, 0);
	};

	function Particle(owner) {
		this.owner = owner;
		this.active = false;
		this.x = 0;
		this.y = 0;
		this.speed = 0;
		this.angle = 0;
		this.opacity = 1;
		this.grow = 0;
		this.size = 0;
		this.gs = 0;			// gravity speed
		this.age = 0;
		cr.seal(this);
	};
	Particle.prototype.init = function () {
		var owner = this.owner;
		this.x = owner.x - (owner.xrandom / 2) + (Math.random() * owner.xrandom);
		this.y = owner.y - (owner.yrandom / 2) + (Math.random() * owner.yrandom);
		this.speed = owner.initspeed - (owner.speedrandom / 2) + (Math.random() * owner.speedrandom);
		this.angle = owner.angle - (owner.spraycone / 2) + (Math.random() * owner.spraycone);
		this.opacity = owner.initopacity;
		this.size = owner.initsize - (owner.sizerandom / 2) + (Math.random() * owner.sizerandom);
		this.grow = owner.growrate - (owner.growrandom / 2) + (Math.random() * owner.growrandom);
		this.gs = 0;
		this.age = 0;
	};
	Particle.prototype.tick = function (dt) {
		var owner = this.owner;
		this.x += Math.cos(this.angle) * this.speed * dt;
		this.y += Math.sin(this.angle) * this.speed * dt;
		this.y += this.gs * dt;
		this.speed += owner.acc * dt;
		this.size += this.grow * dt;
		this.gs += owner.g * dt;
		this.age += dt;
		if (this.size < 1) {
			this.active = false;
			return;
		}
		if (owner.lifeanglerandom !== 0)
			this.angle += (Math.random() * owner.lifeanglerandom * dt) - (owner.lifeanglerandom * dt / 2);
		if (owner.lifespeedrandom !== 0)
			this.speed += (Math.random() * owner.lifespeedrandom * dt) - (owner.lifespeedrandom * dt / 2);
		if (owner.lifeopacityrandom !== 0) {
			this.opacity += (Math.random() * owner.lifeopacityrandom * dt) - (owner.lifeopacityrandom * dt / 2);
			if (this.opacity < 0)
				this.opacity = 0;
			else if (this.opacity > 1)
				this.opacity = 1;
		}
		if (owner.destroymode <= 1 && this.age >= owner.timeout) {
			this.active = false;
		}
		if (owner.destroymode === 2 && this.speed <= 0) {
			this.active = false;
		}
	};
	Particle.prototype.draw = function (ctx) {
		var curopacity = this.owner.opacity * this.opacity;
		if (curopacity === 0)
			return;
		if (this.owner.destroymode === 0)
			curopacity *= 1 - (this.age / this.owner.timeout);
		ctx.globalAlpha = curopacity;
		var drawx = this.x - this.size / 2;
		var drawy = this.y - this.size / 2;
		if (this.owner.runtime.pixel_rounding) {
			drawx = (drawx + 0.5) | 0;
			drawy = (drawy + 0.5) | 0;
		}
		ctx.drawImage(this.owner.type.texture_img, drawx, drawy, this.size, this.size);
	};
	Particle.prototype.drawGL = function (glw) {
		var curopacity = this.owner.opacity * this.opacity;
		if (this.owner.destroymode === 0)
			curopacity *= 1 - (this.age / this.owner.timeout);
		var drawsize = this.size;
		var scaleddrawsize = drawsize * this.owner.particlescale;
		var drawx = this.x - drawsize / 2;
		var drawy = this.y - drawsize / 2;
		if (this.owner.runtime.pixel_rounding) {
			drawx = (drawx + 0.5) | 0;
			drawy = (drawy + 0.5) | 0;
		}
		if (scaleddrawsize < 1 || curopacity === 0)
			return;
		if (scaleddrawsize < glw.minPointSize || scaleddrawsize > glw.maxPointSize) {
			glw.setOpacity(curopacity);
			glw.quad(drawx, drawy, drawx + drawsize, drawy, drawx + drawsize, drawy + drawsize, drawx, drawy + drawsize);
		}
		else
			glw.point(this.x, this.y, scaleddrawsize, curopacity);
	};
	Particle.prototype.left = function () {
		return this.x - this.size / 2;
	};
	Particle.prototype.right = function () {
		return this.x + this.size / 2;
	};
	Particle.prototype.top = function () {
		return this.y - this.size / 2;
	};
	Particle.prototype.bottom = function () {
		return this.y + this.size / 2;
	};
	pluginProto.Instance = function (type) {
		this.type = type;
		this.runtime = type.runtime;
	};
	var instanceProto = pluginProto.Instance.prototype;
	var deadparticles = [];
	instanceProto.onCreate = function () {
		var props = this.properties;
		this.rate = props[0];
		this.spraycone = cr.to_radians(props[1]);
		this.spraytype = props[2];			// 0 = continuous, 1 = one-shot
		this.spraying = true;				// for continuous mode only
		this.initspeed = props[3];
		this.initsize = props[4];
		this.initopacity = props[5] / 100.0;
		this.growrate = props[6];
		this.xrandom = props[7];
		this.yrandom = props[8];
		this.speedrandom = props[9];
		this.sizerandom = props[10];
		this.growrandom = props[11];
		this.acc = props[12];
		this.g = props[13];
		this.lifeanglerandom = props[14];
		this.lifespeedrandom = props[15];
		this.lifeopacityrandom = props[16];
		this.destroymode = props[17];		// 0 = fade, 1 = timeout, 2 = stopped
		this.timeout = props[18];
		this.particleCreateCounter = 0;
		this.particlescale = 1;
		this.particleBoxLeft = this.x;
		this.particleBoxTop = this.y;
		this.particleBoxRight = this.x;
		this.particleBoxBottom = this.y;
		this.add_bbox_changed_callback(function (self) {
			self.bbox.set(self.particleBoxLeft, self.particleBoxTop, self.particleBoxRight, self.particleBoxBottom);
			self.bquad.set_from_rect(self.bbox);
			self.bbox_changed = false;
			self.update_collision_cell();
			self.update_render_cell();
		});
		if (!this.recycled)
			this.particles = [];
		this.runtime.tickMe(this);
		this.type.loadTextures();
		if (this.spraytype === 1) {
			for (var i = 0; i < this.rate; i++)
				this.allocateParticle().opacity = 0;
		}
		this.first_tick = true;		// for re-init'ing one-shot particles on first tick so they assume any new angle/position
	};
	instanceProto.saveToJSON = function () {
		var o = {
			"r": this.rate,
			"sc": this.spraycone,
			"st": this.spraytype,
			"s": this.spraying,
			"isp": this.initspeed,
			"isz": this.initsize,
			"io": this.initopacity,
			"gr": this.growrate,
			"xr": this.xrandom,
			"yr": this.yrandom,
			"spr": this.speedrandom,
			"szr": this.sizerandom,
			"grnd": this.growrandom,
			"acc": this.acc,
			"g": this.g,
			"lar": this.lifeanglerandom,
			"lsr": this.lifespeedrandom,
			"lor": this.lifeopacityrandom,
			"dm": this.destroymode,
			"to": this.timeout,
			"pcc": this.particleCreateCounter,
			"ft": this.first_tick,
			"p": []
		};
		var i, len, p;
		var arr = o["p"];
		for (i = 0, len = this.particles.length; i < len; i++) {
			p = this.particles[i];
			arr.push([p.x, p.y, p.speed, p.angle, p.opacity, p.grow, p.size, p.gs, p.age]);
		}
		return o;
	};
	instanceProto.loadFromJSON = function (o) {
		this.rate = o["r"];
		this.spraycone = o["sc"];
		this.spraytype = o["st"];
		this.spraying = o["s"];
		this.initspeed = o["isp"];
		this.initsize = o["isz"];
		this.initopacity = o["io"];
		this.growrate = o["gr"];
		this.xrandom = o["xr"];
		this.yrandom = o["yr"];
		this.speedrandom = o["spr"];
		this.sizerandom = o["szr"];
		this.growrandom = o["grnd"];
		this.acc = o["acc"];
		this.g = o["g"];
		this.lifeanglerandom = o["lar"];
		this.lifespeedrandom = o["lsr"];
		this.lifeopacityrandom = o["lor"];
		this.destroymode = o["dm"];
		this.timeout = o["to"];
		this.particleCreateCounter = o["pcc"];
		this.first_tick = o["ft"];
		deadparticles.push.apply(deadparticles, this.particles);
		cr.clearArray(this.particles);
		var i, len, p, d;
		var arr = o["p"];
		for (i = 0, len = arr.length; i < len; i++) {
			p = this.allocateParticle();
			d = arr[i];
			p.x = d[0];
			p.y = d[1];
			p.speed = d[2];
			p.angle = d[3];
			p.opacity = d[4];
			p.grow = d[5];
			p.size = d[6];
			p.gs = d[7];
			p.age = d[8];
		}
	};
	instanceProto.onDestroy = function () {
		deadparticles.push.apply(deadparticles, this.particles);
		cr.clearArray(this.particles);
	};
	instanceProto.allocateParticle = function () {
		var p;
		if (deadparticles.length) {
			p = deadparticles.pop();
			p.owner = this;
		}
		else
			p = new Particle(this);
		this.particles.push(p);
		p.active = true;
		return p;
	};
	instanceProto.tick = function () {
		var dt = this.runtime.getDt(this);
		var i, len, p, n, j;
		if (this.spraytype === 0 && this.spraying) {
			this.particleCreateCounter += dt * this.rate;
			n = cr.floor(this.particleCreateCounter);
			this.particleCreateCounter -= n;
			for (i = 0; i < n; i++) {
				p = this.allocateParticle();
				p.init();
			}
		}
		this.particleBoxLeft = this.x;
		this.particleBoxTop = this.y;
		this.particleBoxRight = this.x;
		this.particleBoxBottom = this.y;
		for (i = 0, j = 0, len = this.particles.length; i < len; i++) {
			p = this.particles[i];
			this.particles[j] = p;
			this.runtime.redraw = true;
			if (this.spraytype === 1 && this.first_tick)
				p.init();
			p.tick(dt);
			if (!p.active) {
				deadparticles.push(p);
				continue;
			}
			if (p.left() < this.particleBoxLeft)
				this.particleBoxLeft = p.left();
			if (p.right() > this.particleBoxRight)
				this.particleBoxRight = p.right();
			if (p.top() < this.particleBoxTop)
				this.particleBoxTop = p.top();
			if (p.bottom() > this.particleBoxBottom)
				this.particleBoxBottom = p.bottom();
			j++;
		}
		cr.truncateArray(this.particles, j);
		this.set_bbox_changed();
		this.first_tick = false;
		if (this.spraytype === 1 && this.particles.length === 0)
			this.runtime.DestroyInstance(this);
	};
	instanceProto.draw = function (ctx) {
		var i, len, p, layer = this.layer;
		for (i = 0, len = this.particles.length; i < len; i++) {
			p = this.particles[i];
			if (p.right() >= layer.viewLeft && p.bottom() >= layer.viewTop && p.left() <= layer.viewRight && p.top() <= layer.viewBottom) {
				p.draw(ctx);
			}
		}
	};
	instanceProto.drawGL = function (glw) {
		this.particlescale = this.layer.getScale();
		glw.setTexture(this.type.webGL_texture);
		var i, len, p, layer = this.layer;
		for (i = 0, len = this.particles.length; i < len; i++) {
			p = this.particles[i];
			if (p.right() >= layer.viewLeft && p.bottom() >= layer.viewTop && p.left() <= layer.viewRight && p.top() <= layer.viewBottom) {
				p.drawGL(glw);
			}
		}
	};

	function Cnds() {
	};
	Cnds.prototype.IsSpraying = function () {
		return this.spraying;
	};
	pluginProto.cnds = new Cnds();

	function Acts() {
	};
	Acts.prototype.SetSpraying = function (set_) {
		this.spraying = (set_ !== 0);
	};
	Acts.prototype.SetEffect = function (effect) {
		this.blend_mode = effect;
		this.compositeOp = cr.effectToCompositeOp(effect);
		cr.setGLBlend(this, effect, this.runtime.gl);
		this.runtime.redraw = true;
	};
	Acts.prototype.SetRate = function (x) {
		this.rate = x;
		var diff, i;
		if (this.spraytype === 1 && this.first_tick) {
			if (x < this.particles.length) {
				diff = this.particles.length - x;
				for (i = 0; i < diff; i++)
					deadparticles.push(this.particles.pop());
			}
			else if (x > this.particles.length) {
				diff = x - this.particles.length;
				for (i = 0; i < diff; i++)
					this.allocateParticle().opacity = 0;
			}
		}
	};
	Acts.prototype.SetSprayCone = function (x) {
		this.spraycone = cr.to_radians(x);
	};
	Acts.prototype.SetInitSpeed = function (x) {
		this.initspeed = x;
	};
	Acts.prototype.SetInitSize = function (x) {
		this.initsize = x;
	};
	Acts.prototype.SetInitOpacity = function (x) {
		this.initopacity = x / 100;
	};
	Acts.prototype.SetGrowRate = function (x) {
		this.growrate = x;
	};
	Acts.prototype.SetXRandomiser = function (x) {
		this.xrandom = x;
	};
	Acts.prototype.SetYRandomiser = function (x) {
		this.yrandom = x;
	};
	Acts.prototype.SetSpeedRandomiser = function (x) {
		this.speedrandom = x;
	};
	Acts.prototype.SetSizeRandomiser = function (x) {
		this.sizerandom = x;
	};
	Acts.prototype.SetGrowRateRandomiser = function (x) {
		this.growrandom = x;
	};
	Acts.prototype.SetParticleAcc = function (x) {
		this.acc = x;
	};
	Acts.prototype.SetGravity = function (x) {
		this.g = x;
	};
	Acts.prototype.SetAngleRandomiser = function (x) {
		this.lifeanglerandom = x;
	};
	Acts.prototype.SetLifeSpeedRandomiser = function (x) {
		this.lifespeedrandom = x;
	};
	Acts.prototype.SetOpacityRandomiser = function (x) {
		this.lifeopacityrandom = x;
	};
	Acts.prototype.SetTimeout = function (x) {
		this.timeout = x;
	};
	pluginProto.acts = new Acts();

	function Exps() {
	};
	Exps.prototype.ParticleCount = function (ret) {
		ret.set_int(this.particles.length);
	};
	Exps.prototype.Rate = function (ret) {
		ret.set_float(this.rate);
	};
	Exps.prototype.SprayCone = function (ret) {
		ret.set_float(cr.to_degrees(this.spraycone));
	};
	Exps.prototype.InitSpeed = function (ret) {
		ret.set_float(this.initspeed);
	};
	Exps.prototype.InitSize = function (ret) {
		ret.set_float(this.initsize);
	};
	Exps.prototype.InitOpacity = function (ret) {
		ret.set_float(this.initopacity * 100);
	};
	Exps.prototype.InitGrowRate = function (ret) {
		ret.set_float(this.growrate);
	};
	Exps.prototype.XRandom = function (ret) {
		ret.set_float(this.xrandom);
	};
	Exps.prototype.YRandom = function (ret) {
		ret.set_float(this.yrandom);
	};
	Exps.prototype.InitSpeedRandom = function (ret) {
		ret.set_float(this.speedrandom);
	};
	Exps.prototype.InitSizeRandom = function (ret) {
		ret.set_float(this.sizerandom);
	};
	Exps.prototype.InitGrowRandom = function (ret) {
		ret.set_float(this.growrandom);
	};
	Exps.prototype.ParticleAcceleration = function (ret) {
		ret.set_float(this.acc);
	};
	Exps.prototype.Gravity = function (ret) {
		ret.set_float(this.g);
	};
	Exps.prototype.ParticleAngleRandom = function (ret) {
		ret.set_float(this.lifeanglerandom);
	};
	Exps.prototype.ParticleSpeedRandom = function (ret) {
		ret.set_float(this.lifespeedrandom);
	};
	Exps.prototype.ParticleOpacityRandom = function (ret) {
		ret.set_float(this.lifeopacityrandom);
	};
	Exps.prototype.Timeout = function (ret) {
		ret.set_float(this.timeout);
	};
	pluginProto.exps = new Exps();
}());

cr.plugins_.Rex_Date = function(runtime)
{
	this.runtime = runtime;
};
(function () {
	var pluginProto = cr.plugins_.Rex_Date.prototype;
	pluginProto.Type = function (plugin) {
		this.plugin = plugin;
		this.runtime = plugin.runtime;
	};
	var typeProto = pluginProto.Type.prototype;
	typeProto.onCreate = function () {
	};
	pluginProto.Instance = function (type) {
		this.type = type;
		this.runtime = type.runtime;
	};
	var instanceProto = pluginProto.Instance.prototype;
	instanceProto.onCreate = function () {
		this.timers = {};
		/*
		 {
		 "state":1=run, 0=paused
		 "start": timstamp, updated when resumed
		 "acc": delta-time, updated when paused
		 }
		 */
	};
	var startTimer = function (timer, curTimestamp) {
		if (!timer)
			timer = {};
		if (!curTimestamp)
			curTimestamp = (new Date()).getTime();
		timer["state"] = 1;
		timer["start"] = curTimestamp;
		timer["acc"] = 0;
		return timer;
	};
	var getElapsedTime = function (timer) {
		if (!timer)
			return 0;
		var deltaTime = timer["acc"];
		if (timer["state"] === 1) {
			var curTime = (new Date()).getTime();
			deltaTime += (curTime - timer["start"]);
		}
		return deltaTime;
	};
	var pauseTimer = function (timer) {
		if ((!timer) || (timer["state"] === 0))
			return;
		timer["state"] = 0;
		var curTime = (new Date()).getTime();
		timer["acc"] += (curTime - timer["start"]);
	};
	var resumeTimer = function (timer) {
		if ((!timer) || (timer["state"] === 1))
			return;
		timer["state"] = 1;
		timer["start"] = (new Date()).getTime();
	};
	var getDate = function (timestamp) {
		return (timestamp != null) ? new Date(timestamp) : new Date();
	};
	instanceProto.saveToJSON = function () {
		return {
			"tims": this.timers,
		};
	};
	instanceProto.loadFromJSON = function (o) {
		this.timers = o["tims"];
	};

	function Cnds() {
	};
	pluginProto.cnds = new Cnds();

	function Acts() {
	};
	pluginProto.acts = new Acts();
	Acts.prototype.StartTimer = function (name) {
		this.timers[name] = startTimer(this.timers[name]);
	};
	Acts.prototype.PauseTimer = function (name) {
		pauseTimer(this.timers[name]);
	};
	Acts.prototype.ResumeTimer = function (name) {
		resumeTimer(this.timers[name]);
	};

	function Exps() {
	};
	pluginProto.exps = new Exps();
	Exps.prototype.Year = function (ret, timestamp) {
		ret.set_int(getDate(timestamp).getFullYear());
	};
	Exps.prototype.Month = function (ret, timestamp) {
		ret.set_int(getDate(timestamp).getMonth() + 1);
	};
	Exps.prototype.Date = function (ret, timestamp) {
		ret.set_int(getDate(timestamp).getDate());
	};
	Exps.prototype.Day = function (ret, timestamp) {
		ret.set_int(getDate(timestamp).getDay());
	};
	Exps.prototype.Hours = function (ret, timestamp) {
		ret.set_int(getDate(timestamp).getHours());
	};
	Exps.prototype.Minutes = function (ret, timestamp) {
		ret.set_int(getDate(timestamp).getMinutes());
	};
	Exps.prototype.Seconds = function (ret, timestamp) {
		ret.set_int(getDate(timestamp).getSeconds());
	};
	Exps.prototype.Milliseconds = function (ret, timestamp) {
		ret.set_int(getDate(timestamp).getMilliseconds());
	};
	Exps.prototype.Timer = function (ret, name) {
		ret.set_float(getElapsedTime(this.timers[name]) / 1000);
	};
	Exps.prototype.CurTicks = function (ret) {
		var today = new Date();
		ret.set_int(today.getTime());
	};
	Exps.prototype.UnixTimestamp = function (ret, year, month, day, hours, minutes, seconds, milliseconds) {
		var d;
		if (year == null) {
			d = new Date();
		}
		else {
			month = month || 1;
			day = day || 1;
			hours = hours || 0;
			minutes = minutes || 0;
			seconds = seconds || 0;
			milliseconds = milliseconds || 0;
			d = new Date(year, month - 1, day, hours, minutes, seconds, milliseconds);
		}
		ret.set_float(d.getTime());
	};
	Exps.prototype.Date2UnixTimestamp = function (ret, year, month, day, hours, minutes, seconds, milliseconds) {
		year = year || 2000;
		month = month || 1;
		day = day || 1;
		hours = hours || 0;
		minutes = minutes || 0;
		seconds = seconds || 0;
		milliseconds = milliseconds || 0;
		var timestamp = new Date(year, month - 1, day, hours, minutes, seconds, milliseconds); // build Date object
		ret.set_float(timestamp.getTime());
	};
	Exps.prototype.LocalExpression = function (ret, timestamp, locales) {
		ret.set_string(getDate(timestamp).toLocaleString(locales));
	};
}());
cr.plugins_.Rex_Hash = function(runtime)
{
	this.runtime = runtime;
};
(function () {
	var pluginProto = cr.plugins_.Rex_Hash.prototype;
	pluginProto.Type = function (plugin) {
		this.plugin = plugin;
		this.runtime = plugin.runtime;
	};
	var typeProto = pluginProto.Type.prototype;
	typeProto.onCreate = function () {
	};
	pluginProto.Instance = function (type) {
		this.type = type;
		this.runtime = type.runtime;
	};
	var instanceProto = pluginProto.Instance.prototype;
	instanceProto.onCreate = function () {
		var init_data = this.properties[0];
		if (init_data != "")
			this.hashtable = JSON.parse(init_data);
		else
			this.hashtable = {};
		this.currentEntry = this.hashtable;
		this.setIndent(this.properties[1]);
		this.exp_CurKey = "";
		this.exp_CurValue = 0;
		this.exp_Loopindex = 0;
	};
	instanceProto.cleanAll = function () {
		var key;
		for (key in this.hashtable)
			delete this.hashtable[key];
		this.currentEntry = this.hashtable;
	};
	instanceProto.getEntry = function (keys, root, defaultEntry) {
		var entry = root || this.hashtable;
		if ((keys === "") || (keys.length === 0)) {
		}
		else {
			if (typeof (keys) === "string")
				keys = keys.split(".");
			var i, cnt = keys.length, key;
			for (i = 0; i < cnt; i++) {
				key = keys[i];
				if ((entry[key] == null) || (typeof(entry[key]) !== "object")) {
					var newEntry;
					if (i === cnt - 1) {
						newEntry = defaultEntry || {};
					}
					else {
						newEntry = {};
					}
					entry[key] = newEntry;
				}
				entry = entry[key];
			}
		}
		return entry;
	};
	instanceProto.setCurrentEntry = function (keys, root) {
		this.currentEntry = this.getEntry(keys, root);
	};
	instanceProto.setValue = function (keys, value, root) {
		if ((keys === "") || (keys.length === 0)) {
			if ((value !== null) && typeof(value) === "object") {
				if (root == null)
					this.hashtable = value;
				else
					root = value;
			}
		}
		else {
			if (root == null)
				root = this.hashtable;
			if (typeof (keys) === "string")
				keys = keys.split(".");
			var lastKey = keys.pop();
			var entry = this.getEntry(keys, root);
			entry[lastKey] = value;
		}
	};
	instanceProto.getValue = function (keys, root) {
		if (root == null)
			root = this.hashtable;
		if ((keys == null) || (keys === "") || (keys.length === 0)) {
			return root;
		}
		else {
			if (typeof (keys) === "string")
				keys = keys.split(".");
			var i, cnt = keys.length, key;
			var entry = root;
			for (i = 0; i < cnt; i++) {
				key = keys[i];
				if (entry.hasOwnProperty(key))
					entry = entry[key];
				else
					return;
			}
			return entry;
		}
	};
	instanceProto.removeKey = function (keys) {
		if ((keys === "") || (keys.length === 0)) {
			this.cleanAll();
		}
		else {
			if (typeof (keys) === "string")
				keys = keys.split(".");
			var data = this.getValue(keys);
			if (data === undefined)
				return;
			var lastKey = keys.pop();
			var entry = this.getEntry(keys);
			if (!isArray(entry)) {
				delete entry[lastKey];
			}
			else {
				if ((lastKey < 0) || (lastKey >= entry.length))
					return;
				else if (lastKey === (entry.length - 1))
					entry.pop();
				else if (lastKey === 0)
					entry.shift();
				else
					entry.splice(lastKey, 1);
			}
		}
	};
	instanceProto.setIndent = function (space) {
		if (isNaN(space))
			this.space = space;
		else
			this.sapce = parseInt(space);
	};
	var getItemsCount = function (o) {
		if (o == null)  // nothing
			return (-1);
		else if ((typeof o == "number") || (typeof o == "string"))  // number/string
			return 0;
		else if (o.length != null)  // list
			return o.length;
		var key, cnt = 0;
		for (key in o)
			cnt += 1;
		return cnt;
	};
	var din = function (d, default_value, space) {
		var o;
		if (d === true)
			o = 1;
		else if (d === false)
			o = 0;
		else if (d == null) {
			if (default_value != null)
				o = default_value;
			else
				o = 0;
		}
		else if (typeof(d) == "object") {
			o = JSON.stringify(d, null, space);
		}
		else
			o = d;
		return o;
	};
	var isArray = function (o) {
		return (o instanceof Array);
	}
	instanceProto.saveToJSON = function () {
		return {"d": this.hashtable};
	};
	instanceProto.loadFromJSON = function (o) {
		this.hashtable = o["d"];
	};

	function Cnds() {
	};
	pluginProto.cnds = new Cnds();
	Cnds.prototype.ForEachItem = function (key) {
		var entry = this.getEntry(key);
		var current_frame = this.runtime.getCurrentEventStack();
		var current_event = current_frame.current_event;
		var solModifierAfterCnds = current_frame.isModifierAfterCnds();
		var key, value;
		this.exp_Loopindex = -1;
		for (key in entry) {
			if (solModifierAfterCnds)
				this.runtime.pushCopySol(current_event.solModifiers);
			this.exp_CurKey = key;
			this.exp_CurValue = entry[key];
			this.exp_Loopindex++;
			current_event.retrigger();
			if (solModifierAfterCnds)
				this.runtime.popSol(current_event.solModifiers);
		}
		this.exp_CurKey = "";
		this.exp_CurValue = 0;
		return false;
	};
	Cnds.prototype.KeyExists = function (keys) {
		if (keys == "")
			return false;
		var data = this.getValue(keys);
		return (data !== undefined);
	};
	Cnds.prototype.IsEmpty = function (keys) {
		var entry = this.getEntry(keys);
		var cnt = getItemsCount(entry);
		return (cnt <= 0);
	};

	function Acts() {
	};
	pluginProto.acts = new Acts();
	Acts.prototype.SetValueByKeyString = function (key, val) {
		if (key === "")
			return;
		this.setValue(key, val);
	};
	Acts.prototype.SetCurHashEntey = function (key) {
		this.setCurrentEntry(key);
	};
	Acts.prototype.SetValueInCurHashEntey = function (key, val) {
		if (key === "")
			return;
		this.setValue(key, val, this.currentEntry);
	};
	Acts.prototype.CleanAll = function () {
		this.cleanAll();
	};
	Acts.prototype.StringToHashTable = function (JSON_string) {
		if (JSON_string != "")
			this.hashtable = JSON.parse(JSON_string);
		else
			this.cleanAll();
	};
	Acts.prototype.RemoveByKeyString = function (key) {
		this.removeKey(key);
	};
	Acts.prototype.PickKeysToArray = function (key, arrayObjs) {
		if (!arrayObjs)
			return;
		var arrayObj = arrayObjs.getFirstPicked();
		;
		cr.plugins_.Arr.prototype.acts.SetSize.apply(arrayObj, [0, 1, 1]);
		var entry = this.getEntry(key);
		for (var key in entry)
			cr.plugins_.Arr.prototype.acts.Push.call(arrayObj, 0, key, 0);
	};
	var getFullKey = function (currentKey, key) {
		if (currentKey !== "")
			key = currentKey + "." + key;
		return key;
	};
	Acts.prototype.MergeTwoHashTable = function (hashtable_objs, conflict_handler_mode) {
		if (!hashtable_objs)
			return;
		var hashB = hashtable_objs.getFirstPicked();
		if (hashB == null)
			return;
		;
		var untraversalTables = [], node;
		var curHash, currentKey, keyB, valueB, keyA, valueA, fullKey;
		if (conflict_handler_mode === 2) {
			this.cleanAll();
			conflict_handler_mode = 0;
		}
		switch (conflict_handler_mode) {
			case 0: // Overwrite from hash B
				untraversalTables.push({table: hashB.hashtable, key: ""});
				while (untraversalTables.length !== 0) {
					node = untraversalTables.shift();
					curHash = node.table;
					currentKey = node.key;
					for (keyB in curHash) {
						valueB = curHash[keyB];
						fullKey = getFullKey(currentKey, keyB);
						valueA = this.getValue(fullKey);
						if ((valueB === null) || typeof(valueB) !== "object") {
							this.setValue(fullKey, valueB);
						}
						else {
							if (isArray(valueB) && !isArray(valueA))
								this.setValue(fullKey, []);
							untraversalTables.push({table: valueB, key: fullKey});
						}
					}
				}
				break;
			case 1:  // Merge new keys from hash table B
				untraversalTables.push({table: hashB.hashtable, key: ""});
				while (untraversalTables.length !== 0) {
					node = untraversalTables.shift();
					curHash = node.table;
					currentKey = node.key;
					for (keyB in curHash) {
						valueB = curHash[keyB];
						fullKey = getFullKey(currentKey, keyB);
						valueA = this.getValue(fullKey);
						if (valueA !== undefined)
							continue;
						if ((valueB == null) || typeof(valueB) !== "object") {
							this.setValue(fullKey, valueB);
						}
						else {
							if (isArray(valueB))
								this.setValue(fullKey, []);
							untraversalTables.push({table: valueB, key: fullKey});
						}
					}
				}
				break;
		}
	};
	Acts.prototype.SetJSONByKeyString = function (key, val) {
		val = JSON.parse(val);
		this.setValue(key, val);
	};
	Acts.prototype.AddToValueByKeyString = function (keys, val) {
		if (keys === "")
			return;
		keys = keys.split(".");
		var curValue = this.getValue(keys) || 0;
		this.setValue(keys, curValue + val);
	};
	var _shuffle = function (arr, random_gen) {
		var i = arr.length, j, temp, random_value;
		if (i == 0) return;
		while (--i) {
			random_value = (random_gen == null) ?
				Math.random() : random_gen.random();
			j = Math.floor(random_value * (i + 1));
			temp = arr[i];
			arr[i] = arr[j];
			arr[j] = temp;
		}
	};
	Acts.prototype.Shuffle = function (entryKey) {
		var arr = this.getValue(entryKey);
		if (!isArray(arr))
			return;
		_shuffle(arr);
	};
	Acts.prototype.Sort = function (entryKey, sortKey, sortMode_) {
		var arr = this.getValue(entryKey);
		if (!isArray(arr))
			return;
		if (sortKey === "")
			sortKey = null;
		else
			sortKey = sortKey.split(".");
		var self = this;
		var sortFn = function (itemA, itemB) {
			var valA = (sortKey) ? self.getValue(sortKey, itemA) : itemA;
			var valB = (sortKey) ? self.getValue(sortKey, itemB) : itemB;
			var m = sortMode_;
			if (sortMode_ >= 2)  // logical descending, logical ascending
			{
				valA = parseFloat(valA);
				valB = parseFloat(valB);
				m -= 2;
			}
			switch (m) {
				case 0:  // descending
					if (valA === valB) return 0;
					else if (valA < valB) return 1;
					else return -1;
					break;
				case 1:  // ascending
					if (valA === valB) return 0;
					else if (valA > valB) return 1;
					else return -1;
					break;
			}
		}
		arr.sort(sortFn);
	};
	Acts.prototype.PushJSON = function (keys, val) {
		val = JSON.parse(val);
		Acts.prototype.PushValue.call(this, keys, val);
	};
	Acts.prototype.PushValue = function (keys, val) {
		var arr = this.getEntry(keys, null, []);
		if (!isArray(arr))
			return;
		arr.push(val);
	};
	Acts.prototype.InsertJSON = function (keys, val, idx) {
		val = JSON.parse(val);
		Acts.prototype.InsertValue.call(this, keys, val, idx);
	};
	Acts.prototype.InsertValue = function (keys, val, idx) {
		var arr = this.getEntry(keys, null, []);
		if (!isArray(arr))
			return;
		arr.splice(idx, 0, val);
	};
	Acts.prototype.SetIndent = function (space) {
		this.setIndent(space);
	};

	function Exps() {
	};
	pluginProto.exps = new Exps();
	Exps.prototype.Hash = function (ret, keys, default_value) {
		keys = keys.split(".");
		var val = din(this.getValue(keys), default_value, this.space);
		ret.set_any(val);
	};
	Exps.prototype.At = Exps.prototype.Hash;
	var gKeys = [];
	Exps.prototype.AtKeys = function (ret, key) {
		gKeys.length = 0;
		var i, cnt = arguments.length, k;
		for (i = 1; i < cnt; i++) {
			k = arguments[i];
			if ((typeof (k) === "string") && (k.indexOf(".") !== -1))
				gKeys.push.apply(gKeys, k.split("."));
			else
				gKeys.push(k);
		}
		var val = din(this.getValue(gKeys), null, this.space);
		gKeys.length = 0;
		ret.set_any(val);
	};
	Exps.prototype.Entry = function (ret, key) {
		var val = din(this.currentEntry[key], null, this.space);
		ret.set_any(val);
	};
	Exps.prototype.HashTableToString = function (ret) {
		var json_string = JSON.stringify(this.hashtable, null, this.space);
		ret.set_string(json_string);
	};
	Exps.prototype.CurKey = function (ret) {
		ret.set_string(this.exp_CurKey);
	};
	Exps.prototype.CurValue = function (ret, subKeys, default_value) {
		var val = this.getValue(subKeys, this.exp_CurValue);
		val = din(val, default_value, this.space);
		ret.set_any(val);
	};
	Exps.prototype.ItemCnt = function (ret, keys) {
		var cnt = getItemsCount(this.getValue(keys));
		ret.set_int(cnt);
	};
	Exps.prototype.Keys2ItemCnt = function (ret, key) {
		var keys = (arguments.length > 2) ?
			Array.prototype.slice.call(arguments, 1) :
			[key];
		var cnt = getItemsCount(this.getValue(keys));
		ret.set_int(cnt);
	};
	Exps.prototype.ToString = function (ret) {
		var table;
		if (arguments.length == 1)  // no parameter
			table = this.hashtable;
		else {
			var i, cnt = arguments.length;
			table = {};
			for (i = 1; i < cnt; i = i + 2)
				table[arguments[i]] = arguments[i + 1];
		}
		ret.set_string(JSON.stringify(table, null, this.space));
	};
	Exps.prototype.AsJSON = Exps.prototype.HashTableToString;
	Exps.prototype.RandomKeyAt = function (ret, keys, default_value) {
		var val;
		var o = this.getValue(keys);
		if (typeof(o) === "object") {
			var isArr = isArray(o);
			if (!isArr)
				o = Object.keys(o);
			var cnt = o.length;
			if (cnt > 0) {
				val = Math.floor(Math.random() * cnt);
				if (!isArr)
					val = o[val];
			}
		}
		val = din(val, default_value, this.space);
		ret.set_any(val);
	};
	Exps.prototype.Loopindex = function (ret) {
		ret.set_int(this.exp_Loopindex);
	};
	Exps.prototype.Pop = function (ret, keys, idx) {
		var arr = this.getEntry(keys);
		var val;
		if (arr == null)
			val = 0;
		else if ((idx == null) || (idx === (arr.length - 1)))
			val = arr.pop()
		else
			val = arr.splice(idx, 1);
		ret.set_any(din(val, null, this.space));
	};
}());

cr.plugins_.Rex_ZSorter = function(runtime)
{
	this.runtime = runtime;
};
(function () {
	var pluginProto = cr.plugins_.Rex_ZSorter.prototype;
	pluginProto.Type = function (plugin) {
		this.plugin = plugin;
		this.runtime = plugin.runtime;
	};
	var typeProto = pluginProto.Type.prototype;
	typeProto.onCreate = function () {
	};
	pluginProto.Instance = function (type) {
		this.type = type;
		this.runtime = type.runtime;
	};
	var instanceProto = pluginProto.Instance.prototype;
	var y_increasing = true;
	var x_increasing = true;
	instanceProto.onCreate = function () {
		y_increasing = (this.properties[0] === 0);
		x_increasing = (this.properties[1] === 0);
		this._cmp_uidA = 0;
		this._cmp_uidB = 0;
		this._compared_result = 0;
		this._sort_fn_name = "";
	};
	instanceProto.draw = function (ctx) {
	};
	var _thisArg = null;
	var _sort_fn = function (instance_a, instance_b) {
		_thisArg._cmp_uidA = instance_a.uid;
		_thisArg._cmp_uidB = instance_b.uid;
		_thisArg.runtime.trigger(cr.plugins_.Rex_ZSorter.prototype.cnds.OnSortingFn, _thisArg);
		return _thisArg._compared_result;
	};
	instanceProto.saveToJSON = function () {
		return {"xi": x_increasing};
	};
	instanceProto.loadFromJSON = function (o) {
		x_increasing = o["xi"];
	};

	function Cnds() {
	};
	pluginProto.cnds = new Cnds();
	Cnds.prototype.OnSortingFn = function (name) {
		return (this._sort_fn_name == name);
	};

	function Acts() {
	};
	pluginProto.acts = new Acts();
	var ZSORT = function (instance_a, instance_b) {
		var ax = instance_a.x;
		var ay = instance_a.y;
		var bx = instance_b.x;
		var by = instance_b.y;
		if (ay === by) {
			if (ax === bx)
				return 0;
			else if (x_increasing)
				return (ax > bx) ? 1 : -1;
			else  // !x_increasing
				return (ax < bx) ? 1 : -1;
		}
		else if (y_increasing)
			return (ay > by) ? 1 : -1;
		else // !y_increasing
			return (ay < by) ? 1 : -1;
	}
	Acts.prototype.SortObjsLayerByY = function (layer) {
		if (layer == null) {
			alart("Z Sort: Can not find layer  " + layerparam);
			return;
		}
		layer.instances.sort(ZSORT);
		layer.zindices_stale = true;
		this.runtime.redraw = true;
	};
	Acts.prototype.SetXorder = function (x_order) {
		x_increasing = (x_order === 0);
	};
	Acts.prototype.SortByFn = function (layer, fn_name) {
		if (layer == null) {
			alert("Z Sort: Can not find layer  " + layerparam);
			return;
		}
		_thisArg = this;
		this._sort_fn_name = fn_name;
		layer.instances.sort(_sort_fn);
		layer.zindices_stale = true;
		this.runtime.redraw = true;
	};
	Acts.prototype.SetCmpResultDirectly = function (result) {
		this._compared_result = result;
	};
	Acts.prototype.SetCmpResultCombo = function (result) {
		this._compared_result = result - 1;
	};
	Acts.prototype.SetYorder = function (y_order) {
		y_increasing = (y_order === 0);
	};
	Acts.prototype.ZMoveToObject = function (uidA, where_, uidB) {
		if (uidA == uidB)
			return;
		var instA = this.runtime.getObjectByUID(uidA);
		var instB = this.runtime.getObjectByUID(uidB);
		if ((instA == null) || (instB == null))
			return;
		var isafter = (where_ === 0);
		if (instA.layer.index !== instB.layer.index) {
			instA.layer.removeFromInstanceList(instA, true);
			instA.layer = instB.layer;
			instB.layer.appendToInstanceList(instA, true);
		}
		instA.layer.moveInstanceAdjacent(instA, instB, isafter);
		instA.runtime.redraw = true;
	};

	function Exps() {
	};
	pluginProto.exps = new Exps();
	Exps.prototype.CmpUIDA = function (ret) {
		ret.set_int(this._cmp_uidA);
	};
	Exps.prototype.CmpUIDB = function (ret) {
		ret.set_int(this._cmp_uidB);
	};
}());

cr.plugins_.Sprite = function(runtime)
{
	this.runtime = runtime;
};
(function () {
	var pluginProto = cr.plugins_.Sprite.prototype;
	pluginProto.Type = function (plugin) {
		this.plugin = plugin;
		this.runtime = plugin.runtime;
	};
	var typeProto = pluginProto.Type.prototype;

	function frame_getDataUri() {
		if (this.datauri.length === 0) {
			var tmpcanvas = document.createElement("canvas");
			tmpcanvas.width = this.width;
			tmpcanvas.height = this.height;
			var tmpctx = tmpcanvas.getContext("2d");
			if (this.spritesheeted) {
				tmpctx.drawImage(this.texture_img, this.offx, this.offy, this.width, this.height,
					0, 0, this.width, this.height);
			}
			else {
				tmpctx.drawImage(this.texture_img, 0, 0, this.width, this.height);
			}
			this.datauri = tmpcanvas.toDataURL("image/png");
		}
		return this.datauri;
	};
	typeProto.onCreate = function () {
		if (this.is_family)
			return;
		var i, leni, j, lenj;
		var anim, frame, animobj, frameobj, wt, uv;
		this.all_frames = [];
		this.has_loaded_textures = false;
		for (i = 0, leni = this.animations.length; i < leni; i++) {
			anim = this.animations[i];
			animobj = {};
			animobj.name = anim[0];
			animobj.speed = anim[1];
			animobj.loop = anim[2];
			animobj.repeatcount = anim[3];
			animobj.repeatto = anim[4];
			animobj.pingpong = anim[5];
			animobj.sid = anim[6];
			animobj.frames = [];
			for (j = 0, lenj = anim[7].length; j < lenj; j++) {
				frame = anim[7][j];
				frameobj = {};
				frameobj.texture_file = frame[0];
				frameobj.texture_filesize = frame[1];
				frameobj.offx = frame[2];
				frameobj.offy = frame[3];
				frameobj.width = frame[4];
				frameobj.height = frame[5];
				frameobj.duration = frame[6];
				frameobj.hotspotX = frame[7];
				frameobj.hotspotY = frame[8];
				frameobj.image_points = frame[9];
				frameobj.poly_pts = frame[10];
				frameobj.pixelformat = frame[11];
				frameobj.spritesheeted = (frameobj.width !== 0);
				frameobj.datauri = "";		// generated on demand and cached
				frameobj.getDataUri = frame_getDataUri;
				uv = {};
				uv.left = 0;
				uv.top = 0;
				uv.right = 1;
				uv.bottom = 1;
				frameobj.sheetTex = uv;
				frameobj.webGL_texture = null;
				wt = this.runtime.findWaitingTexture(frame[0]);
				if (wt) {
					frameobj.texture_img = wt;
				}
				else {
					frameobj.texture_img = new Image();
					frameobj.texture_img.cr_src = frame[0];
					frameobj.texture_img.cr_filesize = frame[1];
					frameobj.texture_img.c2webGL_texture = null;
					this.runtime.waitForImageLoad(frameobj.texture_img, frame[0]);
				}
				cr.seal(frameobj);
				animobj.frames.push(frameobj);
				this.all_frames.push(frameobj);
			}
			cr.seal(animobj);
			this.animations[i] = animobj;		// swap array data for object
		}
	};
	typeProto.updateAllCurrentTexture = function () {
		var i, len, inst;
		for (i = 0, len = this.instances.length; i < len; i++) {
			inst = this.instances[i];
			inst.curWebGLTexture = inst.curFrame.webGL_texture;
		}
	};
	typeProto.onLostWebGLContext = function () {
		if (this.is_family)
			return;
		var i, len, frame;
		for (i = 0, len = this.all_frames.length; i < len; ++i) {
			frame = this.all_frames[i];
			frame.texture_img.c2webGL_texture = null;
			frame.webGL_texture = null;
		}
		this.has_loaded_textures = false;
		this.updateAllCurrentTexture();
	};
	typeProto.onRestoreWebGLContext = function () {
		if (this.is_family || !this.instances.length)
			return;
		var i, len, frame;
		for (i = 0, len = this.all_frames.length; i < len; ++i) {
			frame = this.all_frames[i];
			frame.webGL_texture = this.runtime.glwrap.loadTexture(frame.texture_img, false, this.runtime.linearSampling, frame.pixelformat);
		}
		this.updateAllCurrentTexture();
	};
	typeProto.loadTextures = function () {
		if (this.is_family || this.has_loaded_textures || !this.runtime.glwrap)
			return;
		var i, len, frame;
		for (i = 0, len = this.all_frames.length; i < len; ++i) {
			frame = this.all_frames[i];
			frame.webGL_texture = this.runtime.glwrap.loadTexture(frame.texture_img, false, this.runtime.linearSampling, frame.pixelformat);
		}
		this.has_loaded_textures = true;
	};
	typeProto.unloadTextures = function () {
		if (this.is_family || this.instances.length || !this.has_loaded_textures)
			return;
		var i, len, frame;
		for (i = 0, len = this.all_frames.length; i < len; ++i) {
			frame = this.all_frames[i];
			this.runtime.glwrap.deleteTexture(frame.webGL_texture);
			frame.webGL_texture = null;
		}
		this.has_loaded_textures = false;
	};
	var already_drawn_images = [];
	typeProto.preloadCanvas2D = function (ctx) {
		var i, len, frameimg;
		cr.clearArray(already_drawn_images);
		for (i = 0, len = this.all_frames.length; i < len; ++i) {
			frameimg = this.all_frames[i].texture_img;
			if (already_drawn_images.indexOf(frameimg) !== -1)
				continue;
			ctx.drawImage(frameimg, 0, 0);
			already_drawn_images.push(frameimg);
		}
	};
	pluginProto.Instance = function (type) {
		this.type = type;
		this.runtime = type.runtime;
		var poly_pts = this.type.animations[0].frames[0].poly_pts;
		if (this.recycled)
			this.collision_poly.set_pts(poly_pts);
		else
			this.collision_poly = new cr.CollisionPoly(poly_pts);
	};
	var instanceProto = pluginProto.Instance.prototype;
	instanceProto.onCreate = function () {
		this.visible = (this.properties[0] === 0);	// 0=visible, 1=invisible
		this.isTicking = false;
		this.inAnimTrigger = false;
		this.collisionsEnabled = (this.properties[3] !== 0);
		this.cur_animation = this.getAnimationByName(this.properties[1]) || this.type.animations[0];
		this.cur_frame = this.properties[2];
		if (this.cur_frame < 0)
			this.cur_frame = 0;
		if (this.cur_frame >= this.cur_animation.frames.length)
			this.cur_frame = this.cur_animation.frames.length - 1;
		var curanimframe = this.cur_animation.frames[this.cur_frame];
		this.collision_poly.set_pts(curanimframe.poly_pts);
		this.hotspotX = curanimframe.hotspotX;
		this.hotspotY = curanimframe.hotspotY;
		this.cur_anim_speed = this.cur_animation.speed;
		this.cur_anim_repeatto = this.cur_animation.repeatto;
		if (!(this.type.animations.length === 1 && this.type.animations[0].frames.length === 1) && this.cur_anim_speed !== 0) {
			this.runtime.tickMe(this);
			this.isTicking = true;
		}
		if (this.recycled)
			this.animTimer.reset();
		else
			this.animTimer = new cr.KahanAdder();
		this.frameStart = this.getNowTime();
		this.animPlaying = true;
		this.animRepeats = 0;
		this.animForwards = true;
		this.animTriggerName = "";
		this.changeAnimName = "";
		this.changeAnimFrom = 0;
		this.changeAnimFrame = -1;
		this.type.loadTextures();
		var i, leni, j, lenj;
		var anim, frame, uv, maintex;
		for (i = 0, leni = this.type.animations.length; i < leni; i++) {
			anim = this.type.animations[i];
			for (j = 0, lenj = anim.frames.length; j < lenj; j++) {
				frame = anim.frames[j];
				if (frame.width === 0) {
					frame.width = frame.texture_img.width;
					frame.height = frame.texture_img.height;
				}
				if (frame.spritesheeted) {
					maintex = frame.texture_img;
					uv = frame.sheetTex;
					uv.left = frame.offx / maintex.width;
					uv.top = frame.offy / maintex.height;
					uv.right = (frame.offx + frame.width) / maintex.width;
					uv.bottom = (frame.offy + frame.height) / maintex.height;
					if (frame.offx === 0 && frame.offy === 0 && frame.width === maintex.width && frame.height === maintex.height) {
						frame.spritesheeted = false;
					}
				}
			}
		}
		this.curFrame = this.cur_animation.frames[this.cur_frame];
		this.curWebGLTexture = this.curFrame.webGL_texture;
	};
	instanceProto.saveToJSON = function () {
		var o = {
			"a": this.cur_animation.sid,
			"f": this.cur_frame,
			"cas": this.cur_anim_speed,
			"fs": this.frameStart,
			"ar": this.animRepeats,
			"at": this.animTimer.sum,
			"rt": this.cur_anim_repeatto
		};
		if (!this.animPlaying)
			o["ap"] = this.animPlaying;
		if (!this.animForwards)
			o["af"] = this.animForwards;
		return o;
	};
	instanceProto.loadFromJSON = function (o) {
		var anim = this.getAnimationBySid(o["a"]);
		if (anim)
			this.cur_animation = anim;
		this.cur_frame = o["f"];
		if (this.cur_frame < 0)
			this.cur_frame = 0;
		if (this.cur_frame >= this.cur_animation.frames.length)
			this.cur_frame = this.cur_animation.frames.length - 1;
		this.cur_anim_speed = o["cas"];
		this.frameStart = o["fs"];
		this.animRepeats = o["ar"];
		this.animTimer.reset();
		this.animTimer.sum = o["at"];
		this.animPlaying = o.hasOwnProperty("ap") ? o["ap"] : true;
		this.animForwards = o.hasOwnProperty("af") ? o["af"] : true;
		if (o.hasOwnProperty("rt"))
			this.cur_anim_repeatto = o["rt"];
		else
			this.cur_anim_repeatto = this.cur_animation.repeatto;
		this.curFrame = this.cur_animation.frames[this.cur_frame];
		this.curWebGLTexture = this.curFrame.webGL_texture;
		this.collision_poly.set_pts(this.curFrame.poly_pts);
		this.hotspotX = this.curFrame.hotspotX;
		this.hotspotY = this.curFrame.hotspotY;
	};
	instanceProto.animationFinish = function (reverse) {
		this.cur_frame = reverse ? 0 : this.cur_animation.frames.length - 1;
		this.animPlaying = false;
		this.animTriggerName = this.cur_animation.name;
		this.inAnimTrigger = true;
		this.runtime.trigger(cr.plugins_.Sprite.prototype.cnds.OnAnyAnimFinished, this);
		this.runtime.trigger(cr.plugins_.Sprite.prototype.cnds.OnAnimFinished, this);
		this.inAnimTrigger = false;
		this.animRepeats = 0;
	};
	instanceProto.getNowTime = function () {
		return this.animTimer.sum;
	};
	instanceProto.tick = function () {
		this.animTimer.add(this.runtime.getDt(this));
		if (this.changeAnimName.length)
			this.doChangeAnim();
		if (this.changeAnimFrame >= 0)
			this.doChangeAnimFrame();
		var now = this.getNowTime();
		var cur_animation = this.cur_animation;
		var prev_frame = cur_animation.frames[this.cur_frame];
		var next_frame;
		var cur_frame_time = prev_frame.duration / this.cur_anim_speed;
		if (this.animPlaying && now >= this.frameStart + cur_frame_time) {
			if (this.animForwards) {
				this.cur_frame++;
			}
			else {
				this.cur_frame--;
			}
			this.frameStart += cur_frame_time;
			if (this.cur_frame >= cur_animation.frames.length) {
				if (cur_animation.pingpong) {
					this.animForwards = false;
					this.cur_frame = cur_animation.frames.length - 2;
				}
				else if (cur_animation.loop) {
					this.cur_frame = this.cur_anim_repeatto;
				}
				else {
					this.animRepeats++;
					if (this.animRepeats >= cur_animation.repeatcount) {
						this.animationFinish(false);
					}
					else {
						this.cur_frame = this.cur_anim_repeatto;
					}
				}
			}
			if (this.cur_frame < 0) {
				if (cur_animation.pingpong) {
					this.cur_frame = 1;
					this.animForwards = true;
					if (!cur_animation.loop) {
						this.animRepeats++;
						if (this.animRepeats >= cur_animation.repeatcount) {
							this.animationFinish(true);
						}
					}
				}
				else {
					if (cur_animation.loop) {
						this.cur_frame = this.cur_anim_repeatto;
					}
					else {
						this.animRepeats++;
						if (this.animRepeats >= cur_animation.repeatcount) {
							this.animationFinish(true);
						}
						else {
							this.cur_frame = this.cur_anim_repeatto;
						}
					}
				}
			}
			if (this.cur_frame < 0)
				this.cur_frame = 0;
			else if (this.cur_frame >= cur_animation.frames.length)
				this.cur_frame = cur_animation.frames.length - 1;
			if (now > this.frameStart + (cur_animation.frames[this.cur_frame].duration / this.cur_anim_speed)) {
				this.frameStart = now;
			}
			next_frame = cur_animation.frames[this.cur_frame];
			this.OnFrameChanged(prev_frame, next_frame);
			this.runtime.redraw = true;
		}
	};
	instanceProto.getAnimationByName = function (name_) {
		var i, len, a;
		for (i = 0, len = this.type.animations.length; i < len; i++) {
			a = this.type.animations[i];
			if (cr.equals_nocase(a.name, name_))
				return a;
		}
		return null;
	};
	instanceProto.getAnimationBySid = function (sid_) {
		var i, len, a;
		for (i = 0, len = this.type.animations.length; i < len; i++) {
			a = this.type.animations[i];
			if (a.sid === sid_)
				return a;
		}
		return null;
	};
	instanceProto.doChangeAnim = function () {
		var prev_frame = this.cur_animation.frames[this.cur_frame];
		var anim = this.getAnimationByName(this.changeAnimName);
		this.changeAnimName = "";
		if (!anim)
			return;
		if (cr.equals_nocase(anim.name, this.cur_animation.name) && this.animPlaying)
			return;
		this.cur_animation = anim;
		this.cur_anim_speed = anim.speed;
		this.cur_anim_repeatto = anim.repeatto;
		if (this.cur_frame < 0)
			this.cur_frame = 0;
		if (this.cur_frame >= this.cur_animation.frames.length)
			this.cur_frame = this.cur_animation.frames.length - 1;
		if (this.changeAnimFrom === 1)
			this.cur_frame = 0;
		this.animPlaying = true;
		this.frameStart = this.getNowTime();
		this.animForwards = true;
		this.OnFrameChanged(prev_frame, this.cur_animation.frames[this.cur_frame]);
		this.runtime.redraw = true;
	};
	instanceProto.doChangeAnimFrame = function () {
		var prev_frame = this.cur_animation.frames[this.cur_frame];
		var prev_frame_number = this.cur_frame;
		this.cur_frame = cr.floor(this.changeAnimFrame);
		if (this.cur_frame < 0)
			this.cur_frame = 0;
		if (this.cur_frame >= this.cur_animation.frames.length)
			this.cur_frame = this.cur_animation.frames.length - 1;
		if (prev_frame_number !== this.cur_frame) {
			this.OnFrameChanged(prev_frame, this.cur_animation.frames[this.cur_frame]);
			this.frameStart = this.getNowTime();
			this.runtime.redraw = true;
		}
		this.changeAnimFrame = -1;
	};
	instanceProto.OnFrameChanged = function (prev_frame, next_frame) {
		var oldw = prev_frame.width;
		var oldh = prev_frame.height;
		var neww = next_frame.width;
		var newh = next_frame.height;
		if (oldw != neww)
			this.width *= (neww / oldw);
		if (oldh != newh)
			this.height *= (newh / oldh);
		this.hotspotX = next_frame.hotspotX;
		this.hotspotY = next_frame.hotspotY;
		this.collision_poly.set_pts(next_frame.poly_pts);
		this.set_bbox_changed();
		this.curFrame = next_frame;
		this.curWebGLTexture = next_frame.webGL_texture;
		var i, len, b;
		for (i = 0, len = this.behavior_insts.length; i < len; i++) {
			b = this.behavior_insts[i];
			if (b.onSpriteFrameChanged)
				b.onSpriteFrameChanged(prev_frame, next_frame);
		}
		this.runtime.trigger(cr.plugins_.Sprite.prototype.cnds.OnFrameChanged, this);
	};
	instanceProto.draw = function (ctx) {
		ctx.globalAlpha = this.opacity;
		var cur_frame = this.curFrame;
		var spritesheeted = cur_frame.spritesheeted;
		var cur_image = cur_frame.texture_img;
		var myx = this.x;
		var myy = this.y;
		var w = this.width;
		var h = this.height;
		if (this.angle === 0 && w >= 0 && h >= 0) {
			myx -= this.hotspotX * w;
			myy -= this.hotspotY * h;
			if (this.runtime.pixel_rounding) {
				myx = Math.round(myx);
				myy = Math.round(myy);
			}
			if (spritesheeted) {
				ctx.drawImage(cur_image, cur_frame.offx, cur_frame.offy, cur_frame.width, cur_frame.height,
					myx, myy, w, h);
			}
			else {
				ctx.drawImage(cur_image, myx, myy, w, h);
			}
		}
		else {
			if (this.runtime.pixel_rounding) {
				myx = Math.round(myx);
				myy = Math.round(myy);
			}
			ctx.save();
			var widthfactor = w > 0 ? 1 : -1;
			var heightfactor = h > 0 ? 1 : -1;
			ctx.translate(myx, myy);
			if (widthfactor !== 1 || heightfactor !== 1)
				ctx.scale(widthfactor, heightfactor);
			ctx.rotate(this.angle * widthfactor * heightfactor);
			var drawx = 0 - (this.hotspotX * cr.abs(w))
			var drawy = 0 - (this.hotspotY * cr.abs(h));
			if (spritesheeted) {
				ctx.drawImage(cur_image, cur_frame.offx, cur_frame.offy, cur_frame.width, cur_frame.height,
					drawx, drawy, cr.abs(w), cr.abs(h));
			}
			else {
				ctx.drawImage(cur_image, drawx, drawy, cr.abs(w), cr.abs(h));
			}
			ctx.restore();
		}
		/*
		 ctx.strokeStyle = "#f00";
		 ctx.lineWidth = 3;
		 ctx.beginPath();
		 this.collision_poly.cache_poly(this.width, this.height, this.angle);
		 var i, len, ax, ay, bx, by;
		 for (i = 0, len = this.collision_poly.pts_count; i < len; i++)
		 {
		 ax = this.collision_poly.pts_cache[i*2] + this.x;
		 ay = this.collision_poly.pts_cache[i*2+1] + this.y;
		 bx = this.collision_poly.pts_cache[((i+1)%len)*2] + this.x;
		 by = this.collision_poly.pts_cache[((i+1)%len)*2+1] + this.y;
		 ctx.moveTo(ax, ay);
		 ctx.lineTo(bx, by);
		 }
		 ctx.stroke();
		 ctx.closePath();
		 */
		/*
		 if (this.behavior_insts.length >= 1 && this.behavior_insts[0].draw)
		 {
		 this.behavior_insts[0].draw(ctx);
		 }
		 */
	};
	instanceProto.drawGL_earlyZPass = function (glw) {
		this.drawGL(glw);
	};
	instanceProto.drawGL = function (glw) {
		glw.setTexture(this.curWebGLTexture);
		glw.setOpacity(this.opacity);
		var cur_frame = this.curFrame;
		var q = this.bquad;
		if (this.runtime.pixel_rounding) {
			var ox = Math.round(this.x) - this.x;
			var oy = Math.round(this.y) - this.y;
			if (cur_frame.spritesheeted)
				glw.quadTex(q.tlx + ox, q.tly + oy, q.trx + ox, q.try_ + oy, q.brx + ox, q.bry + oy, q.blx + ox, q.bly + oy, cur_frame.sheetTex);
			else
				glw.quad(q.tlx + ox, q.tly + oy, q.trx + ox, q.try_ + oy, q.brx + ox, q.bry + oy, q.blx + ox, q.bly + oy);
		}
		else {
			if (cur_frame.spritesheeted)
				glw.quadTex(q.tlx, q.tly, q.trx, q.try_, q.brx, q.bry, q.blx, q.bly, cur_frame.sheetTex);
			else
				glw.quad(q.tlx, q.tly, q.trx, q.try_, q.brx, q.bry, q.blx, q.bly);
		}
	};
	instanceProto.getImagePointIndexByName = function (name_) {
		var cur_frame = this.curFrame;
		var i, len;
		for (i = 0, len = cur_frame.image_points.length; i < len; i++) {
			if (cr.equals_nocase(name_, cur_frame.image_points[i][0]))
				return i;
		}
		return -1;
	};
	instanceProto.getImagePoint = function (imgpt, getX) {
		var cur_frame = this.curFrame;
		var image_points = cur_frame.image_points;
		var index;
		if (cr.is_string(imgpt))
			index = this.getImagePointIndexByName(imgpt);
		else
			index = imgpt - 1;	// 0 is origin
		index = cr.floor(index);
		if (index < 0 || index >= image_points.length)
			return getX ? this.x : this.y;	// return origin
		var x = (image_points[index][1] - cur_frame.hotspotX) * this.width;
		var y = image_points[index][2];
		y = (y - cur_frame.hotspotY) * this.height;
		var cosa = Math.cos(this.angle);
		var sina = Math.sin(this.angle);
		var x_temp = (x * cosa) - (y * sina);
		y = (y * cosa) + (x * sina);
		x = x_temp;
		x += this.x;
		y += this.y;
		return getX ? x : y;
	};

	function Cnds() {
	};
	var arrCache = [];

	function allocArr() {
		if (arrCache.length)
			return arrCache.pop();
		else
			return [0, 0, 0];
	};

	function freeArr(a) {
		a[0] = 0;
		a[1] = 0;
		a[2] = 0;
		arrCache.push(a);
	};

	function makeCollKey(a, b) {
		if (a < b)
			return "" + a + "," + b;
		else
			return "" + b + "," + a;
	};

	function collmemory_add(collmemory, a, b, tickcount) {
		var a_uid = a.uid;
		var b_uid = b.uid;
		var key = makeCollKey(a_uid, b_uid);
		if (collmemory.hasOwnProperty(key)) {
			collmemory[key][2] = tickcount;
			return;
		}
		var arr = allocArr();
		arr[0] = a_uid;
		arr[1] = b_uid;
		arr[2] = tickcount;
		collmemory[key] = arr;
	};

	function collmemory_remove(collmemory, a, b) {
		var key = makeCollKey(a.uid, b.uid);
		if (collmemory.hasOwnProperty(key)) {
			freeArr(collmemory[key]);
			delete collmemory[key];
		}
	};

	function collmemory_removeInstance(collmemory, inst) {
		var uid = inst.uid;
		var p, entry;
		for (p in collmemory) {
			if (collmemory.hasOwnProperty(p)) {
				entry = collmemory[p];
				if (entry[0] === uid || entry[1] === uid) {
					freeArr(collmemory[p]);
					delete collmemory[p];
				}
			}
		}
	};
	var last_coll_tickcount = -2;

	function collmemory_has(collmemory, a, b) {
		var key = makeCollKey(a.uid, b.uid);
		if (collmemory.hasOwnProperty(key)) {
			last_coll_tickcount = collmemory[key][2];
			return true;
		}
		else {
			last_coll_tickcount = -2;
			return false;
		}
	};
	var candidates1 = [];
	Cnds.prototype.OnCollision = function (rtype) {
		if (!rtype)
			return false;
		var runtime = this.runtime;
		var cnd = runtime.getCurrentCondition();
		var ltype = cnd.type;
		var collmemory = null;
		if (cnd.extra["collmemory"]) {
			collmemory = cnd.extra["collmemory"];
		}
		else {
			collmemory = {};
			cnd.extra["collmemory"] = collmemory;
		}
		if (!cnd.extra["spriteCreatedDestroyCallback"]) {
			cnd.extra["spriteCreatedDestroyCallback"] = true;
			runtime.addDestroyCallback(function (inst) {
				collmemory_removeInstance(cnd.extra["collmemory"], inst);
			});
		}
		var lsol = ltype.getCurrentSol();
		var rsol = rtype.getCurrentSol();
		var linstances = lsol.getObjects();
		var rinstances;
		var l, linst, r, rinst;
		var curlsol, currsol;
		var tickcount = this.runtime.tickcount;
		var lasttickcount = tickcount - 1;
		var exists, run;
		var current_event = runtime.getCurrentEventStack().current_event;
		var orblock = current_event.orblock;
		for (l = 0; l < linstances.length; l++) {
			linst = linstances[l];
			if (rsol.select_all) {
				linst.update_bbox();
				this.runtime.getCollisionCandidates(linst.layer, rtype, linst.bbox, candidates1);
				rinstances = candidates1;
			}
			else
				rinstances = rsol.getObjects();
			for (r = 0; r < rinstances.length; r++) {
				rinst = rinstances[r];
				if (runtime.testOverlap(linst, rinst) || runtime.checkRegisteredCollision(linst, rinst)) {
					exists = collmemory_has(collmemory, linst, rinst);
					run = (!exists || (last_coll_tickcount < lasttickcount));
					collmemory_add(collmemory, linst, rinst, tickcount);
					if (run) {
						runtime.pushCopySol(current_event.solModifiers);
						curlsol = ltype.getCurrentSol();
						currsol = rtype.getCurrentSol();
						curlsol.select_all = false;
						currsol.select_all = false;
						if (ltype === rtype) {
							curlsol.instances.length = 2;	// just use lsol, is same reference as rsol
							curlsol.instances[0] = linst;
							curlsol.instances[1] = rinst;
							ltype.applySolToContainer();
						}
						else {
							curlsol.instances.length = 1;
							currsol.instances.length = 1;
							curlsol.instances[0] = linst;
							currsol.instances[0] = rinst;
							ltype.applySolToContainer();
							rtype.applySolToContainer();
						}
						current_event.retrigger();
						runtime.popSol(current_event.solModifiers);
					}
				}
				else {
					collmemory_remove(collmemory, linst, rinst);
				}
			}
			cr.clearArray(candidates1);
		}
		return false;
	};
	var rpicktype = null;
	var rtopick = new cr.ObjectSet();
	var needscollisionfinish = false;
	var candidates2 = [];
	var temp_bbox = new cr.rect(0, 0, 0, 0);

	function DoOverlapCondition(rtype, offx, offy) {
		if (!rtype)
			return false;
		var do_offset = (offx !== 0 || offy !== 0);
		var oldx, oldy, ret = false, r, lenr, rinst;
		var cnd = this.runtime.getCurrentCondition();
		var ltype = cnd.type;
		var inverted = cnd.inverted;
		var rsol = rtype.getCurrentSol();
		var orblock = this.runtime.getCurrentEventStack().current_event.orblock;
		var rinstances;
		if (rsol.select_all) {
			this.update_bbox();
			temp_bbox.copy(this.bbox);
			temp_bbox.offset(offx, offy);
			this.runtime.getCollisionCandidates(this.layer, rtype, temp_bbox, candidates2);
			rinstances = candidates2;
		}
		else if (orblock) {
			if (this.runtime.isCurrentConditionFirst() && !rsol.else_instances.length && rsol.instances.length)
				rinstances = rsol.instances;
			else
				rinstances = rsol.else_instances;
		}
		else {
			rinstances = rsol.instances;
		}
		rpicktype = rtype;
		needscollisionfinish = (ltype !== rtype && !inverted);
		if (do_offset) {
			oldx = this.x;
			oldy = this.y;
			this.x += offx;
			this.y += offy;
			this.set_bbox_changed();
		}
		for (r = 0, lenr = rinstances.length; r < lenr; r++) {
			rinst = rinstances[r];
			if (this.runtime.testOverlap(this, rinst)) {
				ret = true;
				if (inverted)
					break;
				if (ltype !== rtype)
					rtopick.add(rinst);
			}
		}
		if (do_offset) {
			this.x = oldx;
			this.y = oldy;
			this.set_bbox_changed();
		}
		cr.clearArray(candidates2);
		return ret;
	};
	typeProto.finish = function (do_pick) {
		if (!needscollisionfinish)
			return;
		if (do_pick) {
			var orblock = this.runtime.getCurrentEventStack().current_event.orblock;
			var sol = rpicktype.getCurrentSol();
			var topick = rtopick.valuesRef();
			var i, len, inst;
			if (sol.select_all) {
				sol.select_all = false;
				cr.clearArray(sol.instances);
				for (i = 0, len = topick.length; i < len; ++i) {
					sol.instances[i] = topick[i];
				}
				if (orblock) {
					cr.clearArray(sol.else_instances);
					for (i = 0, len = rpicktype.instances.length; i < len; ++i) {
						inst = rpicktype.instances[i];
						if (!rtopick.contains(inst))
							sol.else_instances.push(inst);
					}
				}
			}
			else {
				if (orblock) {
					var initsize = sol.instances.length;
					for (i = 0, len = topick.length; i < len; ++i) {
						sol.instances[initsize + i] = topick[i];
						cr.arrayFindRemove(sol.else_instances, topick[i]);
					}
				}
				else {
					cr.shallowAssignArray(sol.instances, topick);
				}
			}
			rpicktype.applySolToContainer();
		}
		rtopick.clear();
		needscollisionfinish = false;
	};
	Cnds.prototype.IsOverlapping = function (rtype) {
		return DoOverlapCondition.call(this, rtype, 0, 0);
	};
	Cnds.prototype.IsOverlappingOffset = function (rtype, offx, offy) {
		return DoOverlapCondition.call(this, rtype, offx, offy);
	};
	Cnds.prototype.IsAnimPlaying = function (animname) {
		if (this.changeAnimName.length)
			return cr.equals_nocase(this.changeAnimName, animname);
		else
			return cr.equals_nocase(this.cur_animation.name, animname);
	};
	Cnds.prototype.CompareFrame = function (cmp, framenum) {
		return cr.do_cmp(this.cur_frame, cmp, framenum);
	};
	Cnds.prototype.CompareAnimSpeed = function (cmp, x) {
		var s = (this.animForwards ? this.cur_anim_speed : -this.cur_anim_speed);
		return cr.do_cmp(s, cmp, x);
	};
	Cnds.prototype.OnAnimFinished = function (animname) {
		return cr.equals_nocase(this.animTriggerName, animname);
	};
	Cnds.prototype.OnAnyAnimFinished = function () {
		return true;
	};
	Cnds.prototype.OnFrameChanged = function () {
		return true;
	};
	Cnds.prototype.IsMirrored = function () {
		return this.width < 0;
	};
	Cnds.prototype.IsFlipped = function () {
		return this.height < 0;
	};
	Cnds.prototype.OnURLLoaded = function () {
		return true;
	};
	Cnds.prototype.IsCollisionEnabled = function () {
		return this.collisionsEnabled;
	};
	pluginProto.cnds = new Cnds();

	function Acts() {
	};
	Acts.prototype.Spawn = function (obj, layer, imgpt) {
		if (!obj || !layer)
			return;
		var inst = this.runtime.createInstance(obj, layer, this.getImagePoint(imgpt, true), this.getImagePoint(imgpt, false));
		if (!inst)
			return;
		if (typeof inst.angle !== "undefined") {
			inst.angle = this.angle;
			inst.set_bbox_changed();
		}
		this.runtime.isInOnDestroy++;
		var i, len, s;
		this.runtime.trigger(Object.getPrototypeOf(obj.plugin).cnds.OnCreated, inst);
		if (inst.is_contained) {
			for (i = 0, len = inst.siblings.length; i < len; i++) {
				s = inst.siblings[i];
				this.runtime.trigger(Object.getPrototypeOf(s.type.plugin).cnds.OnCreated, s);
			}
		}
		this.runtime.isInOnDestroy--;
		var cur_act = this.runtime.getCurrentAction();
		var reset_sol = false;
		if (cr.is_undefined(cur_act.extra["Spawn_LastExec"]) || cur_act.extra["Spawn_LastExec"] < this.runtime.execcount) {
			reset_sol = true;
			cur_act.extra["Spawn_LastExec"] = this.runtime.execcount;
		}
		var sol;
		if (obj != this.type) {
			sol = obj.getCurrentSol();
			sol.select_all = false;
			if (reset_sol) {
				cr.clearArray(sol.instances);
				sol.instances[0] = inst;
			}
			else
				sol.instances.push(inst);
			if (inst.is_contained) {
				for (i = 0, len = inst.siblings.length; i < len; i++) {
					s = inst.siblings[i];
					sol = s.type.getCurrentSol();
					sol.select_all = false;
					if (reset_sol) {
						cr.clearArray(sol.instances);
						sol.instances[0] = s;
					}
					else
						sol.instances.push(s);
				}
			}
		}
	};
	Acts.prototype.SetEffect = function (effect) {
		this.blend_mode = effect;
		this.compositeOp = cr.effectToCompositeOp(effect);
		cr.setGLBlend(this, effect, this.runtime.gl);
		this.runtime.redraw = true;
	};
	Acts.prototype.StopAnim = function () {
		this.animPlaying = false;
	};
	Acts.prototype.StartAnim = function (from) {
		this.animPlaying = true;
		this.frameStart = this.getNowTime();
		if (from === 1 && this.cur_frame !== 0) {
			this.changeAnimFrame = 0;
			if (!this.inAnimTrigger)
				this.doChangeAnimFrame();
		}
		if (!this.isTicking) {
			this.runtime.tickMe(this);
			this.isTicking = true;
		}
	};
	Acts.prototype.SetAnim = function (animname, from) {
		this.changeAnimName = animname;
		this.changeAnimFrom = from;
		if (!this.isTicking) {
			this.runtime.tickMe(this);
			this.isTicking = true;
		}
		if (!this.inAnimTrigger)
			this.doChangeAnim();
	};
	Acts.prototype.SetAnimFrame = function (framenumber) {
		this.changeAnimFrame = framenumber;
		if (!this.isTicking) {
			this.runtime.tickMe(this);
			this.isTicking = true;
		}
		if (!this.inAnimTrigger)
			this.doChangeAnimFrame();
	};
	Acts.prototype.SetAnimSpeed = function (s) {
		this.cur_anim_speed = cr.abs(s);
		this.animForwards = (s >= 0);
		if (!this.isTicking) {
			this.runtime.tickMe(this);
			this.isTicking = true;
		}
	};
	Acts.prototype.SetAnimRepeatToFrame = function (s) {
		s = Math.floor(s);
		if (s < 0)
			s = 0;
		if (s >= this.cur_animation.frames.length)
			s = this.cur_animation.frames.length - 1;
		this.cur_anim_repeatto = s;
	};
	Acts.prototype.SetMirrored = function (m) {
		var neww = cr.abs(this.width) * (m === 0 ? -1 : 1);
		if (this.width === neww)
			return;
		this.width = neww;
		this.set_bbox_changed();
	};
	Acts.prototype.SetFlipped = function (f) {
		var newh = cr.abs(this.height) * (f === 0 ? -1 : 1);
		if (this.height === newh)
			return;
		this.height = newh;
		this.set_bbox_changed();
	};
	Acts.prototype.SetScale = function (s) {
		var cur_frame = this.curFrame;
		var mirror_factor = (this.width < 0 ? -1 : 1);
		var flip_factor = (this.height < 0 ? -1 : 1);
		var new_width = cur_frame.width * s * mirror_factor;
		var new_height = cur_frame.height * s * flip_factor;
		if (this.width !== new_width || this.height !== new_height) {
			this.width = new_width;
			this.height = new_height;
			this.set_bbox_changed();
		}
	};
	Acts.prototype.LoadURL = function (url_, resize_, crossOrigin_) {
		var img = new Image();
		var self = this;
		var curFrame_ = this.curFrame;
		img.onload = function () {
			if (curFrame_.texture_img.src === img.src) {
				if (self.runtime.glwrap && self.curFrame === curFrame_)
					self.curWebGLTexture = curFrame_.webGL_texture;
				if (resize_ === 0)		// resize to image size
				{
					self.width = img.width;
					self.height = img.height;
					self.set_bbox_changed();
				}
				self.runtime.redraw = true;
				self.runtime.trigger(cr.plugins_.Sprite.prototype.cnds.OnURLLoaded, self);
				return;
			}
			curFrame_.texture_img = img;
			curFrame_.offx = 0;
			curFrame_.offy = 0;
			curFrame_.width = img.width;
			curFrame_.height = img.height;
			curFrame_.spritesheeted = false;
			curFrame_.datauri = "";
			curFrame_.pixelformat = 0;	// reset to RGBA, since we don't know what type of image will have come in
			if (self.runtime.glwrap) {
				if (curFrame_.webGL_texture)
					self.runtime.glwrap.deleteTexture(curFrame_.webGL_texture);
				curFrame_.webGL_texture = self.runtime.glwrap.loadTexture(img, false, self.runtime.linearSampling);
				if (self.curFrame === curFrame_)
					self.curWebGLTexture = curFrame_.webGL_texture;
				self.type.updateAllCurrentTexture();
			}
			if (resize_ === 0)		// resize to image size
			{
				self.width = img.width;
				self.height = img.height;
				self.set_bbox_changed();
			}
			self.runtime.redraw = true;
			self.runtime.trigger(cr.plugins_.Sprite.prototype.cnds.OnURLLoaded, self);
		};
		if (url_.substr(0, 5) !== "data:" && crossOrigin_ === 0)
			img["crossOrigin"] = "anonymous";
		this.runtime.setImageSrc(img, url_);
	};
	Acts.prototype.SetCollisions = function (set_) {
		if (this.collisionsEnabled === (set_ !== 0))
			return;		// no change
		this.collisionsEnabled = (set_ !== 0);
		if (this.collisionsEnabled)
			this.set_bbox_changed();		// needs to be added back to cells
		else {
			if (this.collcells.right >= this.collcells.left)
				this.type.collision_grid.update(this, this.collcells, null);
			this.collcells.set(0, 0, -1, -1);
		}
	};
	pluginProto.acts = new Acts();

	function Exps() {
	};
	Exps.prototype.AnimationFrame = function (ret) {
		ret.set_int(this.cur_frame);
	};
	Exps.prototype.AnimationFrameCount = function (ret) {
		ret.set_int(this.cur_animation.frames.length);
	};
	Exps.prototype.AnimationName = function (ret) {
		ret.set_string(this.cur_animation.name);
	};
	Exps.prototype.AnimationSpeed = function (ret) {
		ret.set_float(this.animForwards ? this.cur_anim_speed : -this.cur_anim_speed);
	};
	Exps.prototype.ImagePointX = function (ret, imgpt) {
		ret.set_float(this.getImagePoint(imgpt, true));
	};
	Exps.prototype.ImagePointY = function (ret, imgpt) {
		ret.set_float(this.getImagePoint(imgpt, false));
	};
	Exps.prototype.ImagePointCount = function (ret) {
		ret.set_int(this.curFrame.image_points.length);
	};
	Exps.prototype.ImageWidth = function (ret) {
		ret.set_float(this.curFrame.width);
	};
	Exps.prototype.ImageHeight = function (ret) {
		ret.set_float(this.curFrame.height);
	};
	pluginProto.exps = new Exps();
}());

cr.plugins_.Text = function(runtime)
{
	this.runtime = runtime;
};
(function () {
	var pluginProto = cr.plugins_.Text.prototype;
	pluginProto.onCreate = function () {
		pluginProto.acts.SetWidth = function (w) {
			if (this.width !== w) {
				this.width = w;
				this.text_changed = true;	// also recalculate text wrapping
				this.set_bbox_changed();
			}
		};
	};
	pluginProto.Type = function (plugin) {
		this.plugin = plugin;
		this.runtime = plugin.runtime;
	};
	var typeProto = pluginProto.Type.prototype;
	typeProto.onCreate = function () {
	};
	typeProto.onLostWebGLContext = function () {
		if (this.is_family)
			return;
		var i, len, inst;
		for (i = 0, len = this.instances.length; i < len; i++) {
			inst = this.instances[i];
			inst.mycanvas = null;
			inst.myctx = null;
			inst.mytex = null;
		}
	};
	pluginProto.Instance = function (type) {
		this.type = type;
		this.runtime = type.runtime;
		if (this.recycled)
			cr.clearArray(this.lines);
		else
			this.lines = [];		// for word wrapping
		this.text_changed = true;
	};
	var instanceProto = pluginProto.Instance.prototype;
	var requestedWebFonts = {};		// already requested web fonts have an entry here
	instanceProto.onCreate = function () {
		this.text = this.properties[0];
		this.visible = (this.properties[1] === 0);		// 0=visible, 1=invisible
		this.font = this.properties[2];
		this.color = this.properties[3];
		this.halign = this.properties[4];				// 0=left, 1=center, 2=right
		this.valign = this.properties[5];				// 0=top, 1=center, 2=bottom
		this.wrapbyword = (this.properties[7] === 0);	// 0=word, 1=character
		this.lastwidth = this.width;
		this.lastwrapwidth = this.width;
		this.lastheight = this.height;
		this.line_height_offset = this.properties[8];
		this.facename = "";
		this.fontstyle = "";
		this.ptSize = 0;
		this.textWidth = 0;
		this.textHeight = 0;
		this.parseFont();
		this.mycanvas = null;
		this.myctx = null;
		this.mytex = null;
		this.need_text_redraw = false;
		this.last_render_tick = this.runtime.tickcount;
		if (this.recycled)
			this.rcTex.set(0, 0, 1, 1);
		else
			this.rcTex = new cr.rect(0, 0, 1, 1);
		if (this.runtime.glwrap)
			this.runtime.tickMe(this);
		;
	};
	instanceProto.parseFont = function () {
		var arr = this.font.split(" ");
		var i;
		for (i = 0; i < arr.length; i++) {
			if (arr[i].substr(arr[i].length - 2, 2) === "pt") {
				this.ptSize = parseInt(arr[i].substr(0, arr[i].length - 2));
				this.pxHeight = Math.ceil((this.ptSize / 72.0) * 96.0) + 4;	// assume 96dpi...
				if (i > 0)
					this.fontstyle = arr[i - 1];
				this.facename = arr[i + 1];
				for (i = i + 2; i < arr.length; i++)
					this.facename += " " + arr[i];
				break;
			}
		}
	};
	instanceProto.saveToJSON = function () {
		return {
			"t": this.text,
			"f": this.font,
			"c": this.color,
			"ha": this.halign,
			"va": this.valign,
			"wr": this.wrapbyword,
			"lho": this.line_height_offset,
			"fn": this.facename,
			"fs": this.fontstyle,
			"ps": this.ptSize,
			"pxh": this.pxHeight,
			"tw": this.textWidth,
			"th": this.textHeight,
			"lrt": this.last_render_tick
		};
	};
	instanceProto.loadFromJSON = function (o) {
		this.text = o["t"];
		this.font = o["f"];
		this.color = o["c"];
		this.halign = o["ha"];
		this.valign = o["va"];
		this.wrapbyword = o["wr"];
		this.line_height_offset = o["lho"];
		this.facename = o["fn"];
		this.fontstyle = o["fs"];
		this.ptSize = o["ps"];
		this.pxHeight = o["pxh"];
		this.textWidth = o["tw"];
		this.textHeight = o["th"];
		this.last_render_tick = o["lrt"];
		this.text_changed = true;
		this.lastwidth = this.width;
		this.lastwrapwidth = this.width;
		this.lastheight = this.height;
	};
	instanceProto.tick = function () {
		if (this.runtime.glwrap && this.mytex && (this.runtime.tickcount - this.last_render_tick >= 300)) {
			var layer = this.layer;
			this.update_bbox();
			var bbox = this.bbox;
			if (bbox.right < layer.viewLeft || bbox.bottom < layer.viewTop || bbox.left > layer.viewRight || bbox.top > layer.viewBottom) {
				this.runtime.glwrap.deleteTexture(this.mytex);
				this.mytex = null;
				this.myctx = null;
				this.mycanvas = null;
			}
		}
	};
	instanceProto.onDestroy = function () {
		this.myctx = null;
		this.mycanvas = null;
		if (this.runtime.glwrap && this.mytex)
			this.runtime.glwrap.deleteTexture(this.mytex);
		this.mytex = null;
	};
	instanceProto.updateFont = function () {
		this.font = this.fontstyle + " " + this.ptSize.toString() + "pt " + this.facename;
		this.text_changed = true;
		this.runtime.redraw = true;
	};
	instanceProto.draw = function (ctx, glmode) {
		ctx.font = this.font;
		ctx.textBaseline = "top";
		ctx.fillStyle = this.color;
		ctx.globalAlpha = glmode ? 1 : this.opacity;
		var myscale = 1;
		if (glmode) {
			myscale = Math.abs(this.layer.getScale());
			ctx.save();
			ctx.scale(myscale, myscale);
		}
		if (this.text_changed || this.width !== this.lastwrapwidth) {
			this.type.plugin.WordWrap(this.text, this.lines, ctx, this.width, this.wrapbyword);
			this.text_changed = false;
			this.lastwrapwidth = this.width;
		}
		this.update_bbox();
		var penX = glmode ? 0 : this.bquad.tlx;
		var penY = glmode ? 0 : this.bquad.tly;
		if (this.runtime.pixel_rounding) {
			penX = (penX + 0.5) | 0;
			penY = (penY + 0.5) | 0;
		}
		if (this.angle !== 0 && !glmode) {
			ctx.save();
			ctx.translate(penX, penY);
			ctx.rotate(this.angle);
			penX = 0;
			penY = 0;
		}
		var endY = penY + this.height;
		var line_height = this.pxHeight;
		line_height += this.line_height_offset;
		var drawX;
		var i;
		if (this.valign === 1)		// center
			penY += Math.max(this.height / 2 - (this.lines.length * line_height) / 2, 0);
		else if (this.valign === 2)	// bottom
			penY += Math.max(this.height - (this.lines.length * line_height) - 2, 0);
		for (i = 0; i < this.lines.length; i++) {
			drawX = penX;
			if (this.halign === 1)		// center
				drawX = penX + (this.width - this.lines[i].width) / 2;
			else if (this.halign === 2)	// right
				drawX = penX + (this.width - this.lines[i].width);
			ctx.fillText(this.lines[i].text, drawX, penY);
			penY += line_height;
			if (penY >= endY - line_height)
				break;
		}
		if (this.angle !== 0 || glmode)
			ctx.restore();
		this.last_render_tick = this.runtime.tickcount;
	};
	instanceProto.drawGL = function (glw) {
		if (this.width < 1 || this.height < 1)
			return;
		var need_redraw = this.text_changed || this.need_text_redraw;
		this.need_text_redraw = false;
		var layer_scale = this.layer.getScale();
		var layer_angle = this.layer.getAngle();
		var rcTex = this.rcTex;
		var floatscaledwidth = layer_scale * this.width;
		var floatscaledheight = layer_scale * this.height;
		var scaledwidth = Math.ceil(floatscaledwidth);
		var scaledheight = Math.ceil(floatscaledheight);
		var absscaledwidth = Math.abs(scaledwidth);
		var absscaledheight = Math.abs(scaledheight);
		var halfw = this.runtime.draw_width / 2;
		var halfh = this.runtime.draw_height / 2;
		if (!this.myctx) {
			this.mycanvas = document.createElement("canvas");
			this.mycanvas.width = absscaledwidth;
			this.mycanvas.height = absscaledheight;
			this.lastwidth = absscaledwidth;
			this.lastheight = absscaledheight;
			need_redraw = true;
			this.myctx = this.mycanvas.getContext("2d");
		}
		if (absscaledwidth !== this.lastwidth || absscaledheight !== this.lastheight) {
			this.mycanvas.width = absscaledwidth;
			this.mycanvas.height = absscaledheight;
			if (this.mytex) {
				glw.deleteTexture(this.mytex);
				this.mytex = null;
			}
			need_redraw = true;
		}
		if (need_redraw) {
			this.myctx.clearRect(0, 0, absscaledwidth, absscaledheight);
			this.draw(this.myctx, true);
			if (!this.mytex)
				this.mytex = glw.createEmptyTexture(absscaledwidth, absscaledheight, this.runtime.linearSampling, this.runtime.isMobile);
			glw.videoToTexture(this.mycanvas, this.mytex, this.runtime.isMobile);
		}
		this.lastwidth = absscaledwidth;
		this.lastheight = absscaledheight;
		glw.setTexture(this.mytex);
		glw.setOpacity(this.opacity);
		glw.resetModelView();
		glw.translate(-halfw, -halfh);
		glw.updateModelView();
		var q = this.bquad;
		var tlx = this.layer.layerToCanvas(q.tlx, q.tly, true, true);
		var tly = this.layer.layerToCanvas(q.tlx, q.tly, false, true);
		var trx = this.layer.layerToCanvas(q.trx, q.try_, true, true);
		var try_ = this.layer.layerToCanvas(q.trx, q.try_, false, true);
		var brx = this.layer.layerToCanvas(q.brx, q.bry, true, true);
		var bry = this.layer.layerToCanvas(q.brx, q.bry, false, true);
		var blx = this.layer.layerToCanvas(q.blx, q.bly, true, true);
		var bly = this.layer.layerToCanvas(q.blx, q.bly, false, true);
		if (this.runtime.pixel_rounding || (this.angle === 0 && layer_angle === 0)) {
			var ox = ((tlx + 0.5) | 0) - tlx;
			var oy = ((tly + 0.5) | 0) - tly
			tlx += ox;
			tly += oy;
			trx += ox;
			try_ += oy;
			brx += ox;
			bry += oy;
			blx += ox;
			bly += oy;
		}
		if (this.angle === 0 && layer_angle === 0) {
			trx = tlx + scaledwidth;
			try_ = tly;
			brx = trx;
			bry = tly + scaledheight;
			blx = tlx;
			bly = bry;
			rcTex.right = 1;
			rcTex.bottom = 1;
		}
		else {
			rcTex.right = floatscaledwidth / scaledwidth;
			rcTex.bottom = floatscaledheight / scaledheight;
		}
		glw.quadTex(tlx, tly, trx, try_, brx, bry, blx, bly, rcTex);
		glw.resetModelView();
		glw.scale(layer_scale, layer_scale);
		glw.rotateZ(-this.layer.getAngle());
		glw.translate((this.layer.viewLeft + this.layer.viewRight) / -2, (this.layer.viewTop + this.layer.viewBottom) / -2);
		glw.updateModelView();
		this.last_render_tick = this.runtime.tickcount;
	};
	var wordsCache = [];
	pluginProto.TokeniseWords = function (text) {
		cr.clearArray(wordsCache);
		var cur_word = "";
		var ch;
		var i = 0;
		while (i < text.length) {
			ch = text.charAt(i);
			if (ch === "\n") {
				if (cur_word.length) {
					wordsCache.push(cur_word);
					cur_word = "";
				}
				wordsCache.push("\n");
				++i;
			}
			else if (ch === " " || ch === "\t" || ch === "-") {
				do {
					cur_word += text.charAt(i);
					i++;
				}
				while (i < text.length && (text.charAt(i) === " " || text.charAt(i) === "\t"));
				wordsCache.push(cur_word);
				cur_word = "";
			}
			else if (i < text.length) {
				cur_word += ch;
				i++;
			}
		}
		if (cur_word.length)
			wordsCache.push(cur_word);
	};
	var linesCache = [];

	function allocLine() {
		if (linesCache.length)
			return linesCache.pop();
		else
			return {};
	};

	function freeLine(l) {
		linesCache.push(l);
	};

	function freeAllLines(arr) {
		var i, len;
		for (i = 0, len = arr.length; i < len; i++) {
			freeLine(arr[i]);
		}
		cr.clearArray(arr);
	};
	pluginProto.WordWrap = function (text, lines, ctx, width, wrapbyword) {
		if (!text || !text.length) {
			freeAllLines(lines);
			return;
		}
		if (width <= 2.0) {
			freeAllLines(lines);
			return;
		}
		if (text.length <= 100 && text.indexOf("\n") === -1) {
			var all_width = ctx.measureText(text).width;
			if (all_width <= width) {
				freeAllLines(lines);
				lines.push(allocLine());
				lines[0].text = text;
				lines[0].width = all_width;
				return;
			}
		}
		this.WrapText(text, lines, ctx, width, wrapbyword);
	};

	function trimSingleSpaceRight(str) {
		if (!str.length || str.charAt(str.length - 1) !== " ")
			return str;
		return str.substring(0, str.length - 1);
	};
	pluginProto.WrapText = function (text, lines, ctx, width, wrapbyword) {
		var wordArray;
		if (wrapbyword) {
			this.TokeniseWords(text);	// writes to wordsCache
			wordArray = wordsCache;
		}
		else
			wordArray = text;
		var cur_line = "";
		var prev_line;
		var line_width;
		var i;
		var lineIndex = 0;
		var line;
		for (i = 0; i < wordArray.length; i++) {
			if (wordArray[i] === "\n") {
				if (lineIndex >= lines.length)
					lines.push(allocLine());
				cur_line = trimSingleSpaceRight(cur_line);		// for correct center/right alignment
				line = lines[lineIndex];
				line.text = cur_line;
				line.width = ctx.measureText(cur_line).width;
				lineIndex++;
				cur_line = "";
				continue;
			}
			prev_line = cur_line;
			cur_line += wordArray[i];
			line_width = ctx.measureText(cur_line).width;
			if (line_width >= width) {
				if (lineIndex >= lines.length)
					lines.push(allocLine());
				prev_line = trimSingleSpaceRight(prev_line);
				line = lines[lineIndex];
				line.text = prev_line;
				line.width = ctx.measureText(prev_line).width;
				lineIndex++;
				cur_line = wordArray[i];
				if (!wrapbyword && cur_line === " ")
					cur_line = "";
			}
		}
		if (cur_line.length) {
			if (lineIndex >= lines.length)
				lines.push(allocLine());
			cur_line = trimSingleSpaceRight(cur_line);
			line = lines[lineIndex];
			line.text = cur_line;
			line.width = ctx.measureText(cur_line).width;
			lineIndex++;
		}
		for (i = lineIndex; i < lines.length; i++)
			freeLine(lines[i]);
		lines.length = lineIndex;
	};

	function Cnds() {
	};
	Cnds.prototype.CompareText = function (text_to_compare, case_sensitive) {
		if (case_sensitive)
			return this.text == text_to_compare;
		else
			return cr.equals_nocase(this.text, text_to_compare);
	};
	pluginProto.cnds = new Cnds();

	function Acts() {
	};
	Acts.prototype.SetText = function (param) {
		if (cr.is_number(param) && param < 1e9)
			param = Math.round(param * 1e10) / 1e10;	// round to nearest ten billionth - hides floating point errors
		var text_to_set = param.toString();
		if (this.text !== text_to_set) {
			this.text = text_to_set;
			this.text_changed = true;
			this.runtime.redraw = true;
		}
	};
	Acts.prototype.AppendText = function (param) {
		if (cr.is_number(param))
			param = Math.round(param * 1e10) / 1e10;	// round to nearest ten billionth - hides floating point errors
		var text_to_append = param.toString();
		if (text_to_append)	// not empty
		{
			this.text += text_to_append;
			this.text_changed = true;
			this.runtime.redraw = true;
		}
	};
	Acts.prototype.SetFontFace = function (face_, style_) {
		var newstyle = "";
		switch (style_) {
			case 1:
				newstyle = "bold";
				break;
			case 2:
				newstyle = "italic";
				break;
			case 3:
				newstyle = "bold italic";
				break;
		}
		if (face_ === this.facename && newstyle === this.fontstyle)
			return;		// no change
		this.facename = face_;
		this.fontstyle = newstyle;
		this.updateFont();
	};
	Acts.prototype.SetFontSize = function (size_) {
		if (this.ptSize === size_)
			return;
		this.ptSize = size_;
		this.pxHeight = Math.ceil((this.ptSize / 72.0) * 96.0) + 4;	// assume 96dpi...
		this.updateFont();
	};
	Acts.prototype.SetFontColor = function (rgb) {
		var newcolor = "rgb(" + cr.GetRValue(rgb).toString() + "," + cr.GetGValue(rgb).toString() + "," + cr.GetBValue(rgb).toString() + ")";
		if (newcolor === this.color)
			return;
		this.color = newcolor;
		this.need_text_redraw = true;
		this.runtime.redraw = true;
	};
	Acts.prototype.SetWebFont = function (familyname_, cssurl_) {
		if (this.runtime.isDomFree) {
			cr.logexport("[Construct 2] Text plugin: 'Set web font' not supported on this platform - the action has been ignored");
			return;		// DC todo
		}
		var self = this;
		var refreshFunc = (function () {
			self.runtime.redraw = true;
			self.text_changed = true;
		});
		if (requestedWebFonts.hasOwnProperty(cssurl_)) {
			var newfacename = "'" + familyname_ + "'";
			if (this.facename === newfacename)
				return;	// no change
			this.facename = newfacename;
			this.updateFont();
			for (var i = 1; i < 10; i++) {
				setTimeout(refreshFunc, i * 100);
				setTimeout(refreshFunc, i * 1000);
			}
			return;
		}
		var wf = document.createElement("link");
		wf.href = cssurl_;
		wf.rel = "stylesheet";
		wf.type = "text/css";
		wf.onload = refreshFunc;
		document.getElementsByTagName('head')[0].appendChild(wf);
		requestedWebFonts[cssurl_] = true;
		this.facename = "'" + familyname_ + "'";
		this.updateFont();
		for (var i = 1; i < 10; i++) {
			setTimeout(refreshFunc, i * 100);
			setTimeout(refreshFunc, i * 1000);
		}
		;
	};
	Acts.prototype.SetEffect = function (effect) {
		this.blend_mode = effect;
		this.compositeOp = cr.effectToCompositeOp(effect);
		cr.setGLBlend(this, effect, this.runtime.gl);
		this.runtime.redraw = true;
	};
	pluginProto.acts = new Acts();

	function Exps() {
	};
	Exps.prototype.Text = function (ret) {
		ret.set_string(this.text);
	};
	Exps.prototype.FaceName = function (ret) {
		ret.set_string(this.facename);
	};
	Exps.prototype.FaceSize = function (ret) {
		ret.set_int(this.ptSize);
	};
	Exps.prototype.TextWidth = function (ret) {
		var w = 0;
		var i, len, x;
		for (i = 0, len = this.lines.length; i < len; i++) {
			x = this.lines[i].width;
			if (w < x)
				w = x;
		}
		ret.set_int(w);
	};
	Exps.prototype.TextHeight = function (ret) {
		ret.set_int(this.lines.length * (this.pxHeight + this.line_height_offset) - this.line_height_offset);
	};
	pluginProto.exps = new Exps();
}());
;
;
cr.plugins_.TextBox = function(runtime)
{
	this.runtime = runtime;
};
(function () {
	var pluginProto = cr.plugins_.TextBox.prototype;
	pluginProto.Type = function (plugin) {
		this.plugin = plugin;
		this.runtime = plugin.runtime;
	};
	var typeProto = pluginProto.Type.prototype;
	typeProto.onCreate = function () {
	};
	pluginProto.Instance = function (type) {
		this.type = type;
		this.runtime = type.runtime;
	};
	var instanceProto = pluginProto.Instance.prototype;
	var elemTypes = ["text", "password", "email", "number", "tel", "url"];
	if (navigator.userAgent.indexOf("MSIE 9") > -1) {
		elemTypes[2] = "text";
		elemTypes[3] = "text";
		elemTypes[4] = "text";
		elemTypes[5] = "text";
	}
	instanceProto.onCreate = function () {
		if (this.runtime.isDomFree) {
			cr.logexport("[Construct 2] Textbox plugin not supported on this platform - the object will not be created");
			return;
		}
		if (this.properties[7] === 6)	// textarea
		{
			this.elem = document.createElement("textarea");
			// $(this.elem).css("resize", "none");
			this.elem.style.resize = "none"
		}
		else {
			this.elem = document.createElement("input");
			this.elem.type = elemTypes[this.properties[7]];
		}
		this.elem.id = this.properties[9];
		var el = this.runtime.canvasdiv ? this.runtime.canvasdiv : "body"
		el.append(this.elem)
		// $(this.elem).appendTo(this.runtime.canvasdiv ? this.runtime.canvasdiv : "body");
		this.elem["autocomplete"] = "off";
		this.elem.value = this.properties[0];
		this.elem["placeholder"] = this.properties[1];
		this.elem.title = this.properties[2];
		this.elem.disabled = (this.properties[4] === 0);
		this.elem["readOnly"] = (this.properties[5] === 1);
		this.elem["spellcheck"] = (this.properties[6] === 1);
		this.autoFontSize = (this.properties[8] !== 0);
		this.element_hidden = false;
		if (this.properties[3] === 0) {
			// $(this.elem).hide();
			this.elem.style.display = 'none'
			this.visible = false;
			this.element_hidden = true;
		}
		var onchangetrigger = (function (self) {
			return function () {
				self.runtime.trigger(cr.plugins_.TextBox.prototype.cnds.OnTextChanged, self);
			};
		})(this);
		this.elem["oninput"] = onchangetrigger;
		if (navigator.userAgent.indexOf("MSIE") !== -1)
			this.elem["oncut"] = onchangetrigger;
		this.elem.onclick = (function (self) {
			return function (e) {
				e.stopPropagation();
				self.runtime.isInUserInputEvent = true;
				self.runtime.trigger(cr.plugins_.TextBox.prototype.cnds.OnClicked, self);
				self.runtime.isInUserInputEvent = false;
			};
		})(this);
		this.elem.ondblclick = (function (self) {
			return function (e) {
				e.stopPropagation();
				self.runtime.isInUserInputEvent = true;
				self.runtime.trigger(cr.plugins_.TextBox.prototype.cnds.OnDoubleClicked, self);
				self.runtime.isInUserInputEvent = false;
			};
		})(this);
		this.elem.addEventListener("touchstart", function (e) {
			e.stopPropagation();
		}, false);
		this.elem.addEventListener("touchmove", function (e) {
			e.stopPropagation();
		}, false);
		this.elem.addEventListener("touchend", function (e) {
			e.stopPropagation();
		}, false);
		this.elem.addEventListener("mousedown", function (e) {
			e.stopPropagation();
		}, false);
		this.elem.addEventListener("mouseup", function (e) {
			e.stopPropagation();
		}, false);
		this.elem.addEventListener("keydown", function (e) {
			if (e.which !== 13 && e.which != 27)	// allow enter and escape
				e.stopPropagation();
		}, false);
		this.elem.addEventListener("mousedown", function (e) {
			if (e.which !== 13 && e.which != 27)	// allow enter and escape
				e.stopPropagation();
		}, false);
		// $(this.elem).mousedown(function (e) {
		// 	e.stopPropagation();
		// });
		// $(this.elem).mouseup(function (e) {
		// 	e.stopPropagation();
		// });
		// $(this.elem).keydown(function (e) {
		// 	if (e.which !== 13 && e.which != 27)	// allow enter and escape
		// 		e.stopPropagation();
		// });
		// $(this.elem).keyup(function (e) {
		// 	if (e.which !== 13 && e.which != 27)	// allow enter and escape
		// 		e.stopPropagation();
		// });
		this.lastLeft = 0;
		this.lastTop = 0;
		this.lastRight = 0;
		this.lastBottom = 0;
		this.lastWinWidth = 0;
		this.lastWinHeight = 0;
		this.updatePosition(true);
		this.runtime.tickMe(this);
	};
	instanceProto.saveToJSON = function () {
		return {
			"text": this.elem.value,
			"placeholder": this.elem.placeholder,
			"tooltip": this.elem.title,
			"disabled": !!this.elem.disabled,
			"readonly": !!this.elem.readOnly,
			"spellcheck": !!this.elem["spellcheck"]
		};
	};
	instanceProto.loadFromJSON = function (o) {
		this.elem.value = o["text"];
		this.elem.placeholder = o["placeholder"];
		this.elem.title = o["tooltip"];
		this.elem.disabled = o["disabled"];
		this.elem.readOnly = o["readonly"];
		this.elem["spellcheck"] = o["spellcheck"];
	};
	instanceProto.onDestroy = function () {
		if (this.runtime.isDomFree)
			return;
		// $(this.elem).remove();
		this.elem = null;
	};
	instanceProto.tick = function () {
		this.updatePosition();
	};
	instanceProto.updatePosition = function (first) {
		if (this.runtime.isDomFree)
			return;
		var left = this.layer.layerToCanvas(this.x, this.y, true);
		var top = this.layer.layerToCanvas(this.x, this.y, false);
		var right = this.layer.layerToCanvas(this.x + this.width, this.y + this.height, true);
		var bottom = this.layer.layerToCanvas(this.x + this.width, this.y + this.height, false);
		var rightEdge = this.runtime.width / this.runtime.devicePixelRatio;
		var bottomEdge = this.runtime.height / this.runtime.devicePixelRatio;
		if (!this.visible || !this.layer.visible || right <= 0 || bottom <= 0 || left >= rightEdge || top >= bottomEdge) {
			// if (!this.element_hidden)
			// $(this.elem).hide();
			this.element_hidden = true;
			return;
		}
		if (left < 1)
			left = 1;
		if (top < 1)
			top = 1;
		if (right >= rightEdge)
			right = rightEdge - 1;
		if (bottom >= bottomEdge)
			bottom = bottomEdge - 1;
		var curWinWidth = window.innerWidth;
		var curWinHeight = window.innerHeight;
		if (!first && this.lastLeft === left && this.lastTop === top && this.lastRight === right && this.lastBottom === bottom && this.lastWinWidth === curWinWidth && this.lastWinHeight === curWinHeight) {
			if (this.element_hidden) {
				// $(this.elem).show();
				this.element_hidden = false;
			}
			return;
		}
		this.lastLeft = left;
		this.lastTop = top;
		this.lastRight = right;
		this.lastBottom = bottom;
		this.lastWinWidth = curWinWidth;
		this.lastWinHeight = curWinHeight;
		if (this.element_hidden) {
			// $(this.elem).show();
			this.element_hidden = false;
		}
		var offx = Math.round(left) + offset(this.runtime.canvas).left;
		var offy = Math.round(top) + offset(this.runtime.canvas).top;
		this.elem.style.position = 'absolute'
		this.elem.offsetLeft = offx
		this.elem.offsetTop = offy

		this.elem.style.width = Math.round(right - left)
		this.elem.style.height = Math.round(right - left)

		if (this.autoFontSize)
			this.elem.style.fontSize = ((this.layer.getScale(true) / this.runtime.devicePixelRatio) - 0.2) + "em"

		// var offx = Math.round(left) + $(this.runtime.canvas).offset().left;
		// var offy = Math.round(top) + $(this.runtime.canvas).offset().top;
		// $(this.elem).css("position", "absolute");
		// $(this.elem).offset({left: offx, top: offy});
		// $(this.elem).width(Math.round(right - left));
		// $(this.elem).height(Math.round(bottom - top));
		// if (this.autoFontSize)
		// 	$(this.elem).css("font-size", ((this.layer.getScale(true) / this.runtime.devicePixelRatio) - 0.2) + "em");
	};
	instanceProto.draw = function (ctx) {
	};
	instanceProto.drawGL = function (glw) {
	};

	function Cnds() {
	};
	Cnds.prototype.CompareText = function (text, case_) {
		if (this.runtime.isDomFree)
			return false;
		if (case_ === 0)	// insensitive
			return cr.equals_nocase(this.elem.value, text);
		else
			return this.elem.value === text;
	};
	Cnds.prototype.OnTextChanged = function () {
		return true;
	};
	Cnds.prototype.OnClicked = function () {
		return true;
	};
	Cnds.prototype.OnDoubleClicked = function () {
		return true;
	};
	pluginProto.cnds = new Cnds();

	function Acts() {
	};
	Acts.prototype.SetText = function (text) {
		if (this.runtime.isDomFree)
			return;
		this.elem.value = text;
	};
	Acts.prototype.SetPlaceholder = function (text) {
		if (this.runtime.isDomFree)
			return;
		this.elem.placeholder = text;
	};
	Acts.prototype.SetTooltip = function (text) {
		if (this.runtime.isDomFree)
			return;
		this.elem.title = text;
	};
	Acts.prototype.SetVisible = function (vis) {
		if (this.runtime.isDomFree)
			return;
		this.visible = (vis !== 0);
	};
	Acts.prototype.SetEnabled = function (en) {
		if (this.runtime.isDomFree)
			return;
		this.elem.disabled = (en === 0);
	};
	Acts.prototype.SetReadOnly = function (ro) {
		if (this.runtime.isDomFree)
			return;
		this.elem.readOnly = (ro === 0);
	};
	Acts.prototype.SetFocus = function () {
		if (this.runtime.isDomFree)
			return;
		this.elem.focus();
	};
	pluginProto.acts = new Acts();

	function Exps() {
	};
	Exps.prototype.Text = function (ret) {
		if (this.runtime.isDomFree) {
			ret.set_string("");
			return;
		}
		ret.set_string(this.elem.value);
	};
	pluginProto.exps = new Exps();
}());
;
;
cr.plugins_.TiledBg = function(runtime)
{
	this.runtime = runtime;
};
(function () {
	var pluginProto = cr.plugins_.TiledBg.prototype;
	pluginProto.Type = function (plugin) {
		this.plugin = plugin;
		this.runtime = plugin.runtime;
	};
	var typeProto = pluginProto.Type.prototype;
	typeProto.onCreate = function () {
		if (this.is_family)
			return;
		this.texture_img = new Image();
		this.texture_img.cr_filesize = this.texture_filesize;
		this.runtime.waitForImageLoad(this.texture_img, this.texture_file);
		this.pattern = null;
		this.webGL_texture = null;
	};
	typeProto.onLostWebGLContext = function () {
		if (this.is_family)
			return;
		this.webGL_texture = null;
	};
	typeProto.onRestoreWebGLContext = function () {
		if (this.is_family || !this.instances.length)
			return;
		if (!this.webGL_texture) {
			this.webGL_texture = this.runtime.glwrap.loadTexture(this.texture_img, true, this.runtime.linearSampling, this.texture_pixelformat);
		}
		var i, len;
		for (i = 0, len = this.instances.length; i < len; i++)
			this.instances[i].webGL_texture = this.webGL_texture;
	};
	typeProto.loadTextures = function () {
		if (this.is_family || this.webGL_texture || !this.runtime.glwrap)
			return;
		this.webGL_texture = this.runtime.glwrap.loadTexture(this.texture_img, true, this.runtime.linearSampling, this.texture_pixelformat);
	};
	typeProto.unloadTextures = function () {
		if (this.is_family || this.instances.length || !this.webGL_texture)
			return;
		this.runtime.glwrap.deleteTexture(this.webGL_texture);
		this.webGL_texture = null;
	};
	typeProto.preloadCanvas2D = function (ctx) {
		ctx.drawImage(this.texture_img, 0, 0);
	};
	pluginProto.Instance = function (type) {
		this.type = type;
		this.runtime = type.runtime;
	};
	var instanceProto = pluginProto.Instance.prototype;
	instanceProto.onCreate = function () {
		this.visible = (this.properties[0] === 0);							// 0=visible, 1=invisible
		this.rcTex = new cr.rect(0, 0, 0, 0);
		this.has_own_texture = false;										// true if a texture loaded in from URL
		this.texture_img = this.type.texture_img;
		if (this.runtime.glwrap) {
			this.type.loadTextures();
			this.webGL_texture = this.type.webGL_texture;
		}
		else {
			if (!this.type.pattern)
				this.type.pattern = this.runtime.ctx.createPattern(this.type.texture_img, "repeat");
			this.pattern = this.type.pattern;
		}
	};
	instanceProto.afterLoad = function () {
		this.has_own_texture = false;
		this.texture_img = this.type.texture_img;
	};
	instanceProto.onDestroy = function () {
		if (this.runtime.glwrap && this.has_own_texture && this.webGL_texture) {
			this.runtime.glwrap.deleteTexture(this.webGL_texture);
			this.webGL_texture = null;
		}
	};
	instanceProto.draw = function (ctx) {
		ctx.globalAlpha = this.opacity;
		ctx.save();
		ctx.fillStyle = this.pattern;
		var myx = this.x;
		var myy = this.y;
		if (this.runtime.pixel_rounding) {
			myx = Math.round(myx);
			myy = Math.round(myy);
		}
		var drawX = -(this.hotspotX * this.width);
		var drawY = -(this.hotspotY * this.height);
		var offX = drawX % this.texture_img.width;
		var offY = drawY % this.texture_img.height;
		if (offX < 0)
			offX += this.texture_img.width;
		if (offY < 0)
			offY += this.texture_img.height;
		ctx.translate(myx, myy);
		ctx.rotate(this.angle);
		ctx.translate(offX, offY);
		ctx.fillRect(drawX - offX,
			drawY - offY,
			this.width,
			this.height);
		ctx.restore();
	};
	instanceProto.drawGL_earlyZPass = function (glw) {
		this.drawGL(glw);
	};
	instanceProto.drawGL = function (glw) {
		glw.setTexture(this.webGL_texture);
		glw.setOpacity(this.opacity);
		var rcTex = this.rcTex;
		rcTex.right = this.width / this.texture_img.width;
		rcTex.bottom = this.height / this.texture_img.height;
		var q = this.bquad;
		if (this.runtime.pixel_rounding) {
			var ox = Math.round(this.x) - this.x;
			var oy = Math.round(this.y) - this.y;
			glw.quadTex(q.tlx + ox, q.tly + oy, q.trx + ox, q.try_ + oy, q.brx + ox, q.bry + oy, q.blx + ox, q.bly + oy, rcTex);
		}
		else
			glw.quadTex(q.tlx, q.tly, q.trx, q.try_, q.brx, q.bry, q.blx, q.bly, rcTex);
	};

	function Cnds() {
	};
	Cnds.prototype.OnURLLoaded = function () {
		return true;
	};
	pluginProto.cnds = new Cnds();

	function Acts() {
	};
	Acts.prototype.SetEffect = function (effect) {
		this.blend_mode = effect;
		this.compositeOp = cr.effectToCompositeOp(effect);
		cr.setGLBlend(this, effect, this.runtime.gl);
		this.runtime.redraw = true;
	};
	Acts.prototype.LoadURL = function (url_, crossOrigin_) {
		var img = new Image();
		var self = this;
		img.onload = function () {
			self.texture_img = img;
			if (self.runtime.glwrap) {
				if (self.has_own_texture && self.webGL_texture)
					self.runtime.glwrap.deleteTexture(self.webGL_texture);
				self.webGL_texture = self.runtime.glwrap.loadTexture(img, true, self.runtime.linearSampling);
			}
			else {
				self.pattern = self.runtime.ctx.createPattern(img, "repeat");
			}
			self.has_own_texture = true;
			self.runtime.redraw = true;
			self.runtime.trigger(cr.plugins_.TiledBg.prototype.cnds.OnURLLoaded, self);
		};
		if (url_.substr(0, 5) !== "data:" && crossOrigin_ === 0)
			img.crossOrigin = "anonymous";
		this.runtime.setImageSrc(img, url_);
	};
	pluginProto.acts = new Acts();

	function Exps() {
	};
	Exps.prototype.ImageWidth = function (ret) {
		ret.set_float(this.texture_img.width);
	};
	Exps.prototype.ImageHeight = function (ret) {
		ret.set_float(this.texture_img.height);
	};
	pluginProto.exps = new Exps();
}());
;
;
cr.plugins_.Touch = function(runtime)
{
	this.runtime = runtime;
};
(function () {
	var pluginProto = cr.plugins_.Touch.prototype;
	pluginProto.Type = function (plugin) {
		this.plugin = plugin;
		this.runtime = plugin.runtime;
	};
	var typeProto = pluginProto.Type.prototype;
	typeProto.onCreate = function () {
	};
	pluginProto.Instance = function (type) {
		this.type = type;
		this.runtime = type.runtime;
		this.touches = [];
		this.mouseDown = false;
	};
	var instanceProto = pluginProto.Instance.prototype;
	var dummyoffset = {left: 0, top: 0};
	instanceProto.findTouch = function (id) {
		var i, len;
		for (i = 0, len = this.touches.length; i < len; i++) {
			if (this.touches[i]["id"] === id)
				return i;
		}
		return -1;
	};
	var appmobi_accx = 0;
	var appmobi_accy = 0;
	var appmobi_accz = 0;

	function AppMobiGetAcceleration(evt) {
		appmobi_accx = evt.x;
		appmobi_accy = evt.y;
		appmobi_accz = evt.z;
	};
	var pg_accx = 0;
	var pg_accy = 0;
	var pg_accz = 0;

	function PhoneGapGetAcceleration(evt) {
		pg_accx = evt.x;
		pg_accy = evt.y;
		pg_accz = evt.z;
	};
	var theInstance = null;
	var touchinfo_cache = [];

	function AllocTouchInfo(x, y, id, index) {
		var ret;
		if (touchinfo_cache.length)
			ret = touchinfo_cache.pop();
		else
			ret = new TouchInfo();
		ret.init(x, y, id, index);
		return ret;
	};

	function ReleaseTouchInfo(ti) {
		if (touchinfo_cache.length < 100)
			touchinfo_cache.push(ti);
	};
	var GESTURE_HOLD_THRESHOLD = 15;		// max px motion for hold gesture to register
	var GESTURE_HOLD_TIMEOUT = 500;			// time for hold gesture to register
	var GESTURE_TAP_TIMEOUT = 333;			// time for tap gesture to register
	var GESTURE_DOUBLETAP_THRESHOLD = 25;	// max distance apart for taps to be
	function TouchInfo() {
		this.starttime = 0;
		this.time = 0;
		this.lasttime = 0;
		this.startx = 0;
		this.starty = 0;
		this.x = 0;
		this.y = 0;
		this.lastx = 0;
		this.lasty = 0;
		this["id"] = 0;
		this.startindex = 0;
		this.triggeredHold = false;
		this.tooFarForHold = false;
	};
	TouchInfo.prototype.init = function (x, y, id, index) {
		var nowtime = cr.performance_now();
		this.time = nowtime;
		this.lasttime = nowtime;
		this.starttime = nowtime;
		this.startx = x;
		this.starty = y;
		this.x = x;
		this.y = y;
		this.lastx = x;
		this.lasty = y;
		this.width = 0;
		this.height = 0;
		this.pressure = 0;
		this["id"] = id;
		this.startindex = index;
		this.triggeredHold = false;
		this.tooFarForHold = false;
	};
	TouchInfo.prototype.update = function (nowtime, x, y, width, height, pressure) {
		this.lasttime = this.time;
		this.time = nowtime;
		this.lastx = this.x;
		this.lasty = this.y;
		this.x = x;
		this.y = y;
		this.width = width;
		this.height = height;
		this.pressure = pressure;
		if (!this.tooFarForHold && cr.distanceTo(this.startx, this.starty, this.x, this.y) >= GESTURE_HOLD_THRESHOLD) {
			this.tooFarForHold = true;
		}
	};
	TouchInfo.prototype.maybeTriggerHold = function (inst, index) {
		if (this.triggeredHold)
			return;		// already triggered this gesture
		var nowtime = cr.performance_now();
		if (nowtime - this.starttime >= GESTURE_HOLD_TIMEOUT && !this.tooFarForHold && cr.distanceTo(this.startx, this.starty, this.x, this.y) < GESTURE_HOLD_THRESHOLD) {
			this.triggeredHold = true;
			inst.trigger_index = this.startindex;
			inst.trigger_id = this["id"];
			inst.getTouchIndex = index;
			inst.runtime.trigger(cr.plugins_.Touch.prototype.cnds.OnHoldGesture, inst);
			inst.curTouchX = this.x;
			inst.curTouchY = this.y;
			inst.runtime.trigger(cr.plugins_.Touch.prototype.cnds.OnHoldGestureObject, inst);
			inst.getTouchIndex = 0;
		}
	};
	var lastTapX = -1000;
	var lastTapY = -1000;
	var lastTapTime = -10000;
	TouchInfo.prototype.maybeTriggerTap = function (inst, index) {
		if (this.triggeredHold)
			return;
		var nowtime = cr.performance_now();
		if (nowtime - this.starttime <= GESTURE_TAP_TIMEOUT && !this.tooFarForHold && cr.distanceTo(this.startx, this.starty, this.x, this.y) < GESTURE_HOLD_THRESHOLD) {
			inst.trigger_index = this.startindex;
			inst.trigger_id = this["id"];
			inst.getTouchIndex = index;
			if ((nowtime - lastTapTime <= GESTURE_TAP_TIMEOUT * 2) && cr.distanceTo(lastTapX, lastTapY, this.x, this.y) < GESTURE_DOUBLETAP_THRESHOLD) {
				inst.runtime.trigger(cr.plugins_.Touch.prototype.cnds.OnDoubleTapGesture, inst);
				inst.curTouchX = this.x;
				inst.curTouchY = this.y;
				inst.runtime.trigger(cr.plugins_.Touch.prototype.cnds.OnDoubleTapGestureObject, inst);
				lastTapX = -1000;
				lastTapY = -1000;
				lastTapTime = -10000;
			}
			else {
				inst.runtime.trigger(cr.plugins_.Touch.prototype.cnds.OnTapGesture, inst);
				inst.curTouchX = this.x;
				inst.curTouchY = this.y;
				inst.runtime.trigger(cr.plugins_.Touch.prototype.cnds.OnTapGestureObject, inst);
				lastTapX = this.x;
				lastTapY = this.y;
				lastTapTime = nowtime;
			}
			inst.getTouchIndex = 0;
		}
	};
	instanceProto.onCreate = function () {
		theInstance = this;
		this.isWindows8 = !!(typeof window["c2isWindows8"] !== "undefined" && window["c2isWindows8"]);
		this.orient_alpha = 0;
		this.orient_beta = 0;
		this.orient_gamma = 0;
		this.acc_g_x = 0;
		this.acc_g_y = 0;
		this.acc_g_z = 0;
		this.acc_x = 0;
		this.acc_y = 0;
		this.acc_z = 0;
		this.curTouchX = 0;
		this.curTouchY = 0;
		this.trigger_index = 0;
		this.trigger_id = 0;
		this.getTouchIndex = 0;
		this.useMouseInput = (this.properties[0] !== 0);
		var elem = (this.runtime.fullscreen_mode > 0) ? document : this.runtime.canvas;
		var elem2 = document;
		if (this.runtime.isDirectCanvas)
			elem2 = elem = window["Canvas"];
		else if (this.runtime.isCocoonJs)
			elem2 = elem = window;
		var self = this;
		if (typeof PointerEvent !== "undefined") {
			elem.addEventListener("pointerdown",
				function (info) {
					self.onPointerStart(info);
				},
				false
			);
			elem.addEventListener("pointermove",
				function (info) {
					self.onPointerMove(info);
				},
				false
			);
			elem2.addEventListener("pointerup",
				function (info) {
					self.onPointerEnd(info, false);
				},
				false
			);
			elem2.addEventListener("pointercancel",
				function (info) {
					self.onPointerEnd(info, true);
				},
				false
			);
			if (this.runtime.canvas) {
				this.runtime.canvas.addEventListener("MSGestureHold", function (e) {
					e.preventDefault();
				}, false);
				document.addEventListener("MSGestureHold", function (e) {
					e.preventDefault();
				}, false);
				this.runtime.canvas.addEventListener("gesturehold", function (e) {
					e.preventDefault();
				}, false);
				document.addEventListener("gesturehold", function (e) {
					e.preventDefault();
				}, false);
			}
		}
		else if (window.navigator["msPointerEnabled"]) {
			elem.addEventListener("MSPointerDown",
				function (info) {
					self.onPointerStart(info);
				},
				false
			);
			elem.addEventListener("MSPointerMove",
				function (info) {
					self.onPointerMove(info);
				},
				false
			);
			elem2.addEventListener("MSPointerUp",
				function (info) {
					self.onPointerEnd(info, false);
				},
				false
			);
			elem2.addEventListener("MSPointerCancel",
				function (info) {
					self.onPointerEnd(info, true);
				},
				false
			);
			if (this.runtime.canvas) {
				this.runtime.canvas.addEventListener("MSGestureHold", function (e) {
					e.preventDefault();
				}, false);
				document.addEventListener("MSGestureHold", function (e) {
					e.preventDefault();
				}, false);
			}
		}
		else {
			elem.addEventListener("touchstart",
				function (info) {
					self.onTouchStart(info);
				},
				false
			);
			elem.addEventListener("touchmove",
				function (info) {
					self.onTouchMove(info);
				},
				false
			);
			elem2.addEventListener("touchend",
				function (info) {
					self.onTouchEnd(info, false);
				},
				false
			);
			elem2.addEventListener("touchcancel",
				function (info) {
					self.onTouchEnd(info, true);
				},
				false
			);
		}
		if (this.isWindows8) {
			var win8accelerometerFn = function (e) {
				var reading = e["reading"];
				self.acc_x = reading["accelerationX"];
				self.acc_y = reading["accelerationY"];
				self.acc_z = reading["accelerationZ"];
			};
			var win8inclinometerFn = function (e) {
				var reading = e["reading"];
				self.orient_alpha = reading["yawDegrees"];
				self.orient_beta = reading["pitchDegrees"];
				self.orient_gamma = reading["rollDegrees"];
			};
			var accelerometer = Windows["Devices"]["Sensors"]["Accelerometer"]["getDefault"]();
			if (accelerometer) {
				accelerometer["reportInterval"] = Math.max(accelerometer["minimumReportInterval"], 16);
				accelerometer.addEventListener("readingchanged", win8accelerometerFn);
			}
			var inclinometer = Windows["Devices"]["Sensors"]["Inclinometer"]["getDefault"]();
			if (inclinometer) {
				inclinometer["reportInterval"] = Math.max(inclinometer["minimumReportInterval"], 16);
				inclinometer.addEventListener("readingchanged", win8inclinometerFn);
			}
			document.addEventListener("visibilitychange", function (e) {
				if (document["hidden"] || document["msHidden"]) {
					if (accelerometer)
						accelerometer.removeEventListener("readingchanged", win8accelerometerFn);
					if (inclinometer)
						inclinometer.removeEventListener("readingchanged", win8inclinometerFn);
				}
				else {
					if (accelerometer)
						accelerometer.addEventListener("readingchanged", win8accelerometerFn);
					if (inclinometer)
						inclinometer.addEventListener("readingchanged", win8inclinometerFn);
				}
			}, false);
		}
		else {
			window.addEventListener("deviceorientation", function (eventData) {
				self.orient_alpha = eventData["alpha"] || 0;
				self.orient_beta = eventData["beta"] || 0;
				self.orient_gamma = eventData["gamma"] || 0;
			}, false);
			window.addEventListener("devicemotion", function (eventData) {
				if (eventData["accelerationIncludingGravity"]) {
					self.acc_g_x = eventData["accelerationIncludingGravity"]["x"] || 0;
					self.acc_g_y = eventData["accelerationIncludingGravity"]["y"] || 0;
					self.acc_g_z = eventData["accelerationIncludingGravity"]["z"] || 0;
				}
				if (eventData["acceleration"]) {
					self.acc_x = eventData["acceleration"]["x"] || 0;
					self.acc_y = eventData["acceleration"]["y"] || 0;
					self.acc_z = eventData["acceleration"]["z"] || 0;
				}
			}, false);
		}
		if (this.useMouseInput && !this.runtime.isDomFree) {
			document.addEventListener("mousemove", function (info) {
				self.onMouseMove(info);
			}, false);
			document.addEventListener("mousedown", function (info) {
				self.onMouseDown(info);
			}, false);
			document.addEventListener("mouseup", function (info) {
				self.onMouseUp(info);
			}, false);
			// $(document).mousemove(
			// 	function(info) {
			// 		self.onMouseMove(info);
			// 	}
			// );
			// $(document).mousedown(
			// 	function(info) {
			// 		self.onMouseDown(info);
			// 	}
			// );
			// $(document).mouseup(
			// 	function(info) {
			// 		self.onMouseUp(info);
			// 	}
			// );
		}
		if (!this.runtime.isiOS && this.runtime.isCordova && navigator["accelerometer"] && navigator["accelerometer"]["watchAcceleration"]) {
			navigator["accelerometer"]["watchAcceleration"](PhoneGapGetAcceleration, null, {"frequency": 40});
		}
		this.runtime.tick2Me(this);
	};

	function offsetFun(elem) {
		var obj = {
			left: elem.offsetLeft,
			top: elem.offsetTop,
			width: elem.offsetWidth,
			height: elem.offsetHeight
		}
		return obj;
	}

	instanceProto.onPointerMove = function (info) {
		if (info["pointerType"] === info["MSPOINTER_TYPE_MOUSE"] || info["pointerType"] === "mouse")
			return;
		if (info.preventDefault)
			info.preventDefault();
		var i = this.findTouch(info["pointerId"]);
		var nowtime = cr.performance_now();
		if (i >= 0) {
			var offset = this.runtime.isDomFree ? dummyoffset : offsetFun(this.runtime.canvas);
			var t = this.touches[i];
			if (nowtime - t.time < 2)
				return;
			t.update(nowtime, info.pageX - offset.left, info.pageY - offset.top, info.width || 0, info.height || 0, info.pressure || 0);
		}
	};
	instanceProto.onPointerStart = function (info) {
		if (info["pointerType"] === info["MSPOINTER_TYPE_MOUSE"] || info["pointerType"] === "mouse")
			return;
		if (info.preventDefault && cr.isCanvasInputEvent(info))
			info.preventDefault();
		var offset = this.runtime.isDomFree ? dummyoffset : offsetFun(this.runtime.canvas);
		var touchx = info.pageX - offset.left;
		var touchy = info.pageY - offset.top;
		var nowtime = cr.performance_now();
		this.trigger_index = this.touches.length;
		this.trigger_id = info["pointerId"];
		this.touches.push(AllocTouchInfo(touchx, touchy, info["pointerId"], this.trigger_index));
		this.runtime.isInUserInputEvent = true;
		this.runtime.trigger(cr.plugins_.Touch.prototype.cnds.OnNthTouchStart, this);
		this.runtime.trigger(cr.plugins_.Touch.prototype.cnds.OnTouchStart, this);
		this.curTouchX = touchx;
		this.curTouchY = touchy;
		this.runtime.trigger(cr.plugins_.Touch.prototype.cnds.OnTouchObject, this);
		this.runtime.isInUserInputEvent = false;
	};
	instanceProto.onPointerEnd = function (info, isCancel) {
		if (info["pointerType"] === info["MSPOINTER_TYPE_MOUSE"] || info["pointerType"] === "mouse")
			return;
		if (info.preventDefault && cr.isCanvasInputEvent(info))
			info.preventDefault();
		var i = this.findTouch(info["pointerId"]);
		this.trigger_index = (i >= 0 ? this.touches[i].startindex : -1);
		this.trigger_id = (i >= 0 ? this.touches[i]["id"] : -1);
		this.runtime.isInUserInputEvent = true;
		this.runtime.trigger(cr.plugins_.Touch.prototype.cnds.OnNthTouchEnd, this);
		this.runtime.trigger(cr.plugins_.Touch.prototype.cnds.OnTouchEnd, this);
		if (i >= 0) {
			if (!isCancel)
				this.touches[i].maybeTriggerTap(this, i);
			ReleaseTouchInfo(this.touches[i]);
			this.touches.splice(i, 1);
		}
		this.runtime.isInUserInputEvent = false;
	};
	instanceProto.onTouchMove = function (info) {
		if (info.preventDefault)
			info.preventDefault();
		var nowtime = cr.performance_now();
		var i, len, t, u;
		for (i = 0, len = info.changedTouches.length; i < len; i++) {
			t = info.changedTouches[i];
			var j = this.findTouch(t["identifier"]);
			if (j >= 0) {
				var offset = this.runtime.isDomFree ? dummyoffset : offsetFun(this.runtime.canvas);
				u = this.touches[j];
				if (nowtime - u.time < 2)
					continue;
				var touchWidth = (t.radiusX || t.webkitRadiusX || t.mozRadiusX || t.msRadiusX || 0) * 2;
				var touchHeight = (t.radiusY || t.webkitRadiusY || t.mozRadiusY || t.msRadiusY || 0) * 2;
				var touchForce = t.force || t.webkitForce || t.mozForce || t.msForce || 0;
				u.update(nowtime, t.pageX - offset.left, t.pageY - offset.top, touchWidth, touchHeight, touchForce);
			}
		}
	};
	instanceProto.onTouchStart = function (info) {
		if (info.preventDefault && cr.isCanvasInputEvent(info))
			info.preventDefault();
		var offset = this.runtime.isDomFree ? dummyoffset : offsetFun(this.runtime.canvas)
		var nowtime = cr.performance_now();
		this.runtime.isInUserInputEvent = true;
		var i, len, t, j;
		for (i = 0, len = info.changedTouches.length; i < len; i++) {
			t = info.changedTouches[i];
			j = this.findTouch(t["identifier"]);
			if (j !== -1)
				continue;
			var touchx = t.pageX - offset.left;
			var touchy = t.pageY - offset.top;
			this.trigger_index = this.touches.length;
			this.trigger_id = t["identifier"];
			this.touches.push(AllocTouchInfo(touchx, touchy, t["identifier"], this.trigger_index));
			this.runtime.trigger(cr.plugins_.Touch.prototype.cnds.OnNthTouchStart, this);
			this.runtime.trigger(cr.plugins_.Touch.prototype.cnds.OnTouchStart, this);
			this.curTouchX = touchx;
			this.curTouchY = touchy;
			this.runtime.trigger(cr.plugins_.Touch.prototype.cnds.OnTouchObject, this);
		}
		this.runtime.isInUserInputEvent = false;
	};
	instanceProto.onTouchEnd = function (info, isCancel) {
		if (info.preventDefault && cr.isCanvasInputEvent(info))
			info.preventDefault();
		this.runtime.isInUserInputEvent = true;
		var i, len, t, j;
		for (i = 0, len = info.changedTouches.length; i < len; i++) {
			t = info.changedTouches[i];
			j = this.findTouch(t["identifier"]);
			if (j >= 0) {
				this.trigger_index = this.touches[j].startindex;
				this.trigger_id = this.touches[j]["id"];
				this.runtime.trigger(cr.plugins_.Touch.prototype.cnds.OnNthTouchEnd, this);
				this.runtime.trigger(cr.plugins_.Touch.prototype.cnds.OnTouchEnd, this);
				if (!isCancel)
					this.touches[j].maybeTriggerTap(this, j);
				ReleaseTouchInfo(this.touches[j]);
				this.touches.splice(j, 1);
			}
		}
		this.runtime.isInUserInputEvent = false;
	};
	instanceProto.getAlpha = function () {
		if (this.runtime.isCordova && this.orient_alpha === 0 && pg_accz !== 0)
			return pg_accz * 90;
		else
			return this.orient_alpha;
	};
	instanceProto.getBeta = function () {
		if (this.runtime.isCordova && this.orient_beta === 0 && pg_accy !== 0)
			return pg_accy * 90;
		else
			return this.orient_beta;
	};
	instanceProto.getGamma = function () {
		if (this.runtime.isCordova && this.orient_gamma === 0 && pg_accx !== 0)
			return pg_accx * 90;
		else
			return this.orient_gamma;
	};
	var noop_func = function () {
	};
	instanceProto.onMouseDown = function (info) {
		var t = {pageX: info.pageX, pageY: info.pageY, "identifier": 0};
		var fakeinfo = {changedTouches: [t]};
		this.onTouchStart(fakeinfo);
		this.mouseDown = true;
	};
	instanceProto.onMouseMove = function (info) {
		if (!this.mouseDown)
			return;
		var t = {pageX: info.pageX, pageY: info.pageY, "identifier": 0};
		var fakeinfo = {changedTouches: [t]};
		this.onTouchMove(fakeinfo);
	};
	instanceProto.onMouseUp = function (info) {
		if (info.preventDefault && this.runtime.had_a_click && !this.runtime.isMobile)
			info.preventDefault();
		this.runtime.had_a_click = true;
		var t = {pageX: info.pageX, pageY: info.pageY, "identifier": 0};
		var fakeinfo = {changedTouches: [t]};
		this.onTouchEnd(fakeinfo);
		this.mouseDown = false;
	};
	instanceProto.tick2 = function () {
		var i, len, t;
		var nowtime = cr.performance_now();
		for (i = 0, len = this.touches.length; i < len; ++i) {
			t = this.touches[i];
			if (t.time <= nowtime - 50)
				t.lasttime = nowtime;
			t.maybeTriggerHold(this, i);
		}
	};

	function Cnds() {
	};
	Cnds.prototype.OnTouchStart = function () {
		return true;
	};
	Cnds.prototype.OnTouchEnd = function () {
		return true;
	};
	Cnds.prototype.IsInTouch = function () {
		return this.touches.length;
	};
	Cnds.prototype.OnTouchObject = function (type) {
		if (!type)
			return false;
		return this.runtime.testAndSelectCanvasPointOverlap(type, this.curTouchX, this.curTouchY, false);
	};
	var touching = [];
	Cnds.prototype.IsTouchingObject = function (type) {
		if (!type)
			return false;
		var sol = type.getCurrentSol();
		var instances = sol.getObjects();
		var px, py;
		var i, leni, j, lenj;
		for (i = 0, leni = instances.length; i < leni; i++) {
			var inst = instances[i];
			inst.update_bbox();
			for (j = 0, lenj = this.touches.length; j < lenj; j++) {
				var touch = this.touches[j];
				px = inst.layer.canvasToLayer(touch.x, touch.y, true);
				py = inst.layer.canvasToLayer(touch.x, touch.y, false);
				if (inst.contains_pt(px, py)) {
					touching.push(inst);
					break;
				}
			}
		}
		if (touching.length) {
			sol.select_all = false;
			cr.shallowAssignArray(sol.instances, touching);
			type.applySolToContainer();
			cr.clearArray(touching);
			return true;
		}
		else
			return false;
	};
	Cnds.prototype.CompareTouchSpeed = function (index, cmp, s) {
		index = Math.floor(index);
		if (index < 0 || index >= this.touches.length)
			return false;
		var t = this.touches[index];
		var dist = cr.distanceTo(t.x, t.y, t.lastx, t.lasty);
		var timediff = (t.time - t.lasttime) / 1000;
		var speed = 0;
		if (timediff > 0)
			speed = dist / timediff;
		return cr.do_cmp(speed, cmp, s);
	};
	Cnds.prototype.OrientationSupported = function () {
		return typeof window["DeviceOrientationEvent"] !== "undefined";
	};
	Cnds.prototype.MotionSupported = function () {
		return typeof window["DeviceMotionEvent"] !== "undefined";
	};
	Cnds.prototype.CompareOrientation = function (orientation_, cmp_, angle_) {
		var v = 0;
		if (orientation_ === 0)
			v = this.getAlpha();
		else if (orientation_ === 1)
			v = this.getBeta();
		else
			v = this.getGamma();
		return cr.do_cmp(v, cmp_, angle_);
	};
	Cnds.prototype.CompareAcceleration = function (acceleration_, cmp_, angle_) {
		var v = 0;
		if (acceleration_ === 0)
			v = this.acc_g_x;
		else if (acceleration_ === 1)
			v = this.acc_g_y;
		else if (acceleration_ === 2)
			v = this.acc_g_z;
		else if (acceleration_ === 3)
			v = this.acc_x;
		else if (acceleration_ === 4)
			v = this.acc_y;
		else if (acceleration_ === 5)
			v = this.acc_z;
		return cr.do_cmp(v, cmp_, angle_);
	};
	Cnds.prototype.OnNthTouchStart = function (touch_) {
		touch_ = Math.floor(touch_);
		return touch_ === this.trigger_index;
	};
	Cnds.prototype.OnNthTouchEnd = function (touch_) {
		touch_ = Math.floor(touch_);
		return touch_ === this.trigger_index;
	};
	Cnds.prototype.HasNthTouch = function (touch_) {
		touch_ = Math.floor(touch_);
		return this.touches.length >= touch_ + 1;
	};
	Cnds.prototype.OnHoldGesture = function () {
		return true;
	};
	Cnds.prototype.OnTapGesture = function () {
		return true;
	};
	Cnds.prototype.OnDoubleTapGesture = function () {
		return true;
	};
	Cnds.prototype.OnHoldGestureObject = function (type) {
		if (!type)
			return false;
		return this.runtime.testAndSelectCanvasPointOverlap(type, this.curTouchX, this.curTouchY, false);
	};
	Cnds.prototype.OnTapGestureObject = function (type) {
		if (!type)
			return false;
		return this.runtime.testAndSelectCanvasPointOverlap(type, this.curTouchX, this.curTouchY, false);
	};
	Cnds.prototype.OnDoubleTapGestureObject = function (type) {
		if (!type)
			return false;
		return this.runtime.testAndSelectCanvasPointOverlap(type, this.curTouchX, this.curTouchY, false);
	};
	pluginProto.cnds = new Cnds();

	function Exps() {
	};
	Exps.prototype.TouchCount = function (ret) {
		ret.set_int(this.touches.length);
	};
	Exps.prototype.X = function (ret, layerparam) {
		var index = this.getTouchIndex;
		if (index < 0 || index >= this.touches.length) {
			ret.set_float(0);
			return;
		}
		var layer, oldScale, oldZoomRate, oldParallaxX, oldAngle;
		if (cr.is_undefined(layerparam)) {
			layer = this.runtime.getLayerByNumber(0);
			oldScale = layer.scale;
			oldZoomRate = layer.zoomRate;
			oldParallaxX = layer.parallaxX;
			oldAngle = layer.angle;
			layer.scale = 1;
			layer.zoomRate = 1.0;
			layer.parallaxX = 1.0;
			layer.angle = 0;
			ret.set_float(layer.canvasToLayer(this.touches[index].x, this.touches[index].y, true));
			layer.scale = oldScale;
			layer.zoomRate = oldZoomRate;
			layer.parallaxX = oldParallaxX;
			layer.angle = oldAngle;
		}
		else {
			if (cr.is_number(layerparam))
				layer = this.runtime.getLayerByNumber(layerparam);
			else
				layer = this.runtime.getLayerByName(layerparam);
			if (layer)
				ret.set_float(layer.canvasToLayer(this.touches[index].x, this.touches[index].y, true));
			else
				ret.set_float(0);
		}
	};
	Exps.prototype.XAt = function (ret, index, layerparam) {
		index = Math.floor(index);
		if (index < 0 || index >= this.touches.length) {
			ret.set_float(0);
			return;
		}
		var layer, oldScale, oldZoomRate, oldParallaxX, oldAngle;
		if (cr.is_undefined(layerparam)) {
			layer = this.runtime.getLayerByNumber(0);
			oldScale = layer.scale;
			oldZoomRate = layer.zoomRate;
			oldParallaxX = layer.parallaxX;
			oldAngle = layer.angle;
			layer.scale = 1;
			layer.zoomRate = 1.0;
			layer.parallaxX = 1.0;
			layer.angle = 0;
			ret.set_float(layer.canvasToLayer(this.touches[index].x, this.touches[index].y, true));
			layer.scale = oldScale;
			layer.zoomRate = oldZoomRate;
			layer.parallaxX = oldParallaxX;
			layer.angle = oldAngle;
		}
		else {
			if (cr.is_number(layerparam))
				layer = this.runtime.getLayerByNumber(layerparam);
			else
				layer = this.runtime.getLayerByName(layerparam);
			if (layer)
				ret.set_float(layer.canvasToLayer(this.touches[index].x, this.touches[index].y, true));
			else
				ret.set_float(0);
		}
	};
	Exps.prototype.XForID = function (ret, id, layerparam) {
		var index = this.findTouch(id);
		if (index < 0) {
			ret.set_float(0);
			return;
		}
		var touch = this.touches[index];
		var layer, oldScale, oldZoomRate, oldParallaxX, oldAngle;
		if (cr.is_undefined(layerparam)) {
			layer = this.runtime.getLayerByNumber(0);
			oldScale = layer.scale;
			oldZoomRate = layer.zoomRate;
			oldParallaxX = layer.parallaxX;
			oldAngle = layer.angle;
			layer.scale = 1;
			layer.zoomRate = 1.0;
			layer.parallaxX = 1.0;
			layer.angle = 0;
			ret.set_float(layer.canvasToLayer(touch.x, touch.y, true));
			layer.scale = oldScale;
			layer.zoomRate = oldZoomRate;
			layer.parallaxX = oldParallaxX;
			layer.angle = oldAngle;
		}
		else {
			if (cr.is_number(layerparam))
				layer = this.runtime.getLayerByNumber(layerparam);
			else
				layer = this.runtime.getLayerByName(layerparam);
			if (layer)
				ret.set_float(layer.canvasToLayer(touch.x, touch.y, true));
			else
				ret.set_float(0);
		}
	};
	Exps.prototype.Y = function (ret, layerparam) {
		var index = this.getTouchIndex;
		if (index < 0 || index >= this.touches.length) {
			ret.set_float(0);
			return;
		}
		var layer, oldScale, oldZoomRate, oldParallaxY, oldAngle;
		if (cr.is_undefined(layerparam)) {
			layer = this.runtime.getLayerByNumber(0);
			oldScale = layer.scale;
			oldZoomRate = layer.zoomRate;
			oldParallaxY = layer.parallaxY;
			oldAngle = layer.angle;
			layer.scale = 1;
			layer.zoomRate = 1.0;
			layer.parallaxY = 1.0;
			layer.angle = 0;
			ret.set_float(layer.canvasToLayer(this.touches[index].x, this.touches[index].y, false));
			layer.scale = oldScale;
			layer.zoomRate = oldZoomRate;
			layer.parallaxY = oldParallaxY;
			layer.angle = oldAngle;
		}
		else {
			if (cr.is_number(layerparam))
				layer = this.runtime.getLayerByNumber(layerparam);
			else
				layer = this.runtime.getLayerByName(layerparam);
			if (layer)
				ret.set_float(layer.canvasToLayer(this.touches[index].x, this.touches[index].y, false));
			else
				ret.set_float(0);
		}
	};
	Exps.prototype.YAt = function (ret, index, layerparam) {
		index = Math.floor(index);
		if (index < 0 || index >= this.touches.length) {
			ret.set_float(0);
			return;
		}
		var layer, oldScale, oldZoomRate, oldParallaxY, oldAngle;
		if (cr.is_undefined(layerparam)) {
			layer = this.runtime.getLayerByNumber(0);
			oldScale = layer.scale;
			oldZoomRate = layer.zoomRate;
			oldParallaxY = layer.parallaxY;
			oldAngle = layer.angle;
			layer.scale = 1;
			layer.zoomRate = 1.0;
			layer.parallaxY = 1.0;
			layer.angle = 0;
			ret.set_float(layer.canvasToLayer(this.touches[index].x, this.touches[index].y, false));
			layer.scale = oldScale;
			layer.zoomRate = oldZoomRate;
			layer.parallaxY = oldParallaxY;
			layer.angle = oldAngle;
		}
		else {
			if (cr.is_number(layerparam))
				layer = this.runtime.getLayerByNumber(layerparam);
			else
				layer = this.runtime.getLayerByName(layerparam);
			if (layer)
				ret.set_float(layer.canvasToLayer(this.touches[index].x, this.touches[index].y, false));
			else
				ret.set_float(0);
		}
	};
	Exps.prototype.YForID = function (ret, id, layerparam) {
		var index = this.findTouch(id);
		if (index < 0) {
			ret.set_float(0);
			return;
		}
		var touch = this.touches[index];
		var layer, oldScale, oldZoomRate, oldParallaxY, oldAngle;
		if (cr.is_undefined(layerparam)) {
			layer = this.runtime.getLayerByNumber(0);
			oldScale = layer.scale;
			oldZoomRate = layer.zoomRate;
			oldParallaxY = layer.parallaxY;
			oldAngle = layer.angle;
			layer.scale = 1;
			layer.zoomRate = 1.0;
			layer.parallaxY = 1.0;
			layer.angle = 0;
			ret.set_float(layer.canvasToLayer(touch.x, touch.y, false));
			layer.scale = oldScale;
			layer.zoomRate = oldZoomRate;
			layer.parallaxY = oldParallaxY;
			layer.angle = oldAngle;
		}
		else {
			if (cr.is_number(layerparam))
				layer = this.runtime.getLayerByNumber(layerparam);
			else
				layer = this.runtime.getLayerByName(layerparam);
			if (layer)
				ret.set_float(layer.canvasToLayer(touch.x, touch.y, false));
			else
				ret.set_float(0);
		}
	};
	Exps.prototype.AbsoluteX = function (ret) {
		if (this.touches.length)
			ret.set_float(this.touches[0].x);
		else
			ret.set_float(0);
	};
	Exps.prototype.AbsoluteXAt = function (ret, index) {
		index = Math.floor(index);
		if (index < 0 || index >= this.touches.length) {
			ret.set_float(0);
			return;
		}
		ret.set_float(this.touches[index].x);
	};
	Exps.prototype.AbsoluteXForID = function (ret, id) {
		var index = this.findTouch(id);
		if (index < 0) {
			ret.set_float(0);
			return;
		}
		var touch = this.touches[index];
		ret.set_float(touch.x);
	};
	Exps.prototype.AbsoluteY = function (ret) {
		if (this.touches.length)
			ret.set_float(this.touches[0].y);
		else
			ret.set_float(0);
	};
	Exps.prototype.AbsoluteYAt = function (ret, index) {
		index = Math.floor(index);
		if (index < 0 || index >= this.touches.length) {
			ret.set_float(0);
			return;
		}
		ret.set_float(this.touches[index].y);
	};
	Exps.prototype.AbsoluteYForID = function (ret, id) {
		var index = this.findTouch(id);
		if (index < 0) {
			ret.set_float(0);
			return;
		}
		var touch = this.touches[index];
		ret.set_float(touch.y);
	};
	Exps.prototype.SpeedAt = function (ret, index) {
		index = Math.floor(index);
		if (index < 0 || index >= this.touches.length) {
			ret.set_float(0);
			return;
		}
		var t = this.touches[index];
		var dist = cr.distanceTo(t.x, t.y, t.lastx, t.lasty);
		var timediff = (t.time - t.lasttime) / 1000;
		if (timediff === 0)
			ret.set_float(0);
		else
			ret.set_float(dist / timediff);
	};
	Exps.prototype.SpeedForID = function (ret, id) {
		var index = this.findTouch(id);
		if (index < 0) {
			ret.set_float(0);
			return;
		}
		var touch = this.touches[index];
		var dist = cr.distanceTo(touch.x, touch.y, touch.lastx, touch.lasty);
		var timediff = (touch.time - touch.lasttime) / 1000;
		if (timediff === 0)
			ret.set_float(0);
		else
			ret.set_float(dist / timediff);
	};
	Exps.prototype.AngleAt = function (ret, index) {
		index = Math.floor(index);
		if (index < 0 || index >= this.touches.length) {
			ret.set_float(0);
			return;
		}
		var t = this.touches[index];
		ret.set_float(cr.to_degrees(cr.angleTo(t.lastx, t.lasty, t.x, t.y)));
	};
	Exps.prototype.AngleForID = function (ret, id) {
		var index = this.findTouch(id);
		if (index < 0) {
			ret.set_float(0);
			return;
		}
		var touch = this.touches[index];
		ret.set_float(cr.to_degrees(cr.angleTo(touch.lastx, touch.lasty, touch.x, touch.y)));
	};
	Exps.prototype.Alpha = function (ret) {
		ret.set_float(this.getAlpha());
	};
	Exps.prototype.Beta = function (ret) {
		ret.set_float(this.getBeta());
	};
	Exps.prototype.Gamma = function (ret) {
		ret.set_float(this.getGamma());
	};
	Exps.prototype.AccelerationXWithG = function (ret) {
		ret.set_float(this.acc_g_x);
	};
	Exps.prototype.AccelerationYWithG = function (ret) {
		ret.set_float(this.acc_g_y);
	};
	Exps.prototype.AccelerationZWithG = function (ret) {
		ret.set_float(this.acc_g_z);
	};
	Exps.prototype.AccelerationX = function (ret) {
		ret.set_float(this.acc_x);
	};
	Exps.prototype.AccelerationY = function (ret) {
		ret.set_float(this.acc_y);
	};
	Exps.prototype.AccelerationZ = function (ret) {
		ret.set_float(this.acc_z);
	};
	Exps.prototype.TouchIndex = function (ret) {
		ret.set_int(this.trigger_index);
	};
	Exps.prototype.TouchID = function (ret) {
		ret.set_float(this.trigger_id);
	};
	Exps.prototype.WidthForID = function (ret, id) {
		var index = this.findTouch(id);
		if (index < 0) {
			ret.set_float(0);
			return;
		}
		var touch = this.touches[index];
		ret.set_float(touch.width);
	};
	Exps.prototype.HeightForID = function (ret, id) {
		var index = this.findTouch(id);
		if (index < 0) {
			ret.set_float(0);
			return;
		}
		var touch = this.touches[index];
		ret.set_float(touch.height);
	};
	Exps.prototype.PressureForID = function (ret, id) {
		var index = this.findTouch(id);
		if (index < 0) {
			ret.set_float(0);
			return;
		}
		var touch = this.touches[index];
		ret.set_float(touch.pressure);
	};
	pluginProto.exps = new Exps();
}());
;
;
cr.plugins_.vooxe = function(runtime)
{
	this.runtime = runtime;
};
(function () {
	var pluginProto = cr.plugins_.vooxe.prototype;
	pluginProto.Type = function (plugin) {
		this.plugin = plugin;
		this.runtime = plugin.runtime;
	};
	var typeProto = pluginProto.Type.prototype;
	typeProto.onCreate = function () {
	};
	pluginProto.Instance = function (type) {
		this.type = type;
		this.runtime = type.runtime;
		window["vooxe"] = {};
	};
	var instanceProto = pluginProto.Instance.prototype;
	var isSupported = false;
	instanceProto.onCreate = function () {
		if (!window["vooxe"]) {
			cr.logexport("[Construct 2] Vooxe Googleads plugin is required to show googleads ads with Cordova; other platforms are not supported");
			return;
		}
		isSupported = true;
		this.vooxe = window["vooxe"];
		var self = this;
		this.vooxe["onInit"] = function (data) {
			cr.logexport(data.Msg);
			self.isShowingBannerAd = false;
			self.runtime.trigger(cr.plugins_.vooxe.prototype.cnds.onInit, self);
		};
		this.vooxe["onError"] = function (data) {
			cr.logexport("Vooxe Googleads Plugin onError: " + data);
			self.isShowingBannerAd = true;
			self.runtime.trigger(cr.plugins_.vooxe.prototype.cnds.onError, self);
		};
		this.vooxe["onResumeGame"] = function () {
			cr.logexport("Vooxe Googleads Plugin: onResume");
			self.isShowingBannerAd = false;
			self.runtime.trigger(cr.plugins_.vooxe.prototype.cnds.onResumeGame, self);
		};
		this.vooxe["onPauseGame"] = function () {
			cr.logexport("Vooxe Googleads Plugin: onPauseGame");
			self.isShowingBannerAd = true;
			self.runtime.trigger(cr.plugins_.vooxe.prototype.cnds.onPauseGame, self);
		};
		this.vooxe["InitAds"] = function () {
			var settings = {
				gameId: self.properties[0],
				userId: self.properties[1],
				resumeGame: self.vooxe.onResumeGame,
				pauseGame: self.vooxe.onPauseGame,
				onInit: self.vooxe.onInit,
				onError: self.vooxe.onError
			};
			(function (i, s, o, g, r, a, m) {
				i['GameDistribution'] = r;
				i[r] = i[r] || function () {
					(i[r].q = i[r].q || []).push(arguments)
				};
				i[r].l = 1 * new Date();
				a = s.createElement(o);
				m = s.getElementsByTagName(o)[0];
				a.async = 1;
				a.src = g;
				m.parentNode.insertBefore(a, m);
			})(window, document, 'script', '//html5.api.gamedistribution.com/libs/gd/api.js', 'gdApi');
			gdApi(settings);
		}
	};

	function Cnds() {
	};
	Cnds.prototype.IsShowingBanner = function () {
		return this.isShowingBannerAd;
	};
	Cnds.prototype.onInit = function () {
		return true;
	};
	Cnds.prototype.onError = function (data) {
		return true;
	};
	Cnds.prototype.onResumeGame = function (data) {
		return true;
	};
	Cnds.prototype.onPauseGame = function (data) {
		return true;
	};
	pluginProto.cnds = new Cnds();

	function Acts() {
	};
	Acts.prototype.ShowBanner = function (key) {
		if (!isSupported) return;
		if (typeof (gdApi.showBanner) === "undefined") {
			cr.logexport("Vooxe Googleads Plugin is not initiliazed or AdBlocker");
			this.vooxe["onResumeGame"]();
			return;
		}
		gdApi.showBanner("{_key:" + key + "}");
		cr.logexport("ShowBanner Key: " + key);
		this.isShowingBannerAd = true;
	};
	Acts.prototype.PlayLog = function () {
		if (!isSupported) return;
		if (typeof (gdApi.play) === "undefined") {
			cr.logexport("Vooxe Googleads Plugin is not initiliazed.");
			this.vooxe["onResumeGame"]();
			return;
		}
		gdApi.play();
	};
	Acts.prototype.CustomLog = function (key) {
		if (!isSupported) return;
		if (typeof (gdApi.customLog) === "undefined") {
			cr.logexport("Vooxe Googleads Plugin is not initiliazed.");
			this.vooxe["onResumeGame"]();
			return;
		}
		gdApi.customLog(key)
	};
	Acts.prototype.InitAds = function () {
		if (!isSupported) return;
		this.vooxe["InitAds"]();
	};
	pluginProto.acts = new Acts();

	function Exps() {
	};
	pluginProto.exps = new Exps();
}());
;
;
cr.behaviors.Bullet = function(runtime)
{
	this.runtime = runtime;
};
(function () {
	var behaviorProto = cr.behaviors.Bullet.prototype;
	behaviorProto.Type = function (behavior, objtype) {
		this.behavior = behavior;
		this.objtype = objtype;
		this.runtime = behavior.runtime;
	};
	var behtypeProto = behaviorProto.Type.prototype;
	behtypeProto.onCreate = function () {
	};
	behaviorProto.Instance = function (type, inst) {
		this.type = type;
		this.behavior = type.behavior;
		this.inst = inst;				// associated object instance to modify
		this.runtime = type.runtime;
	};
	var behinstProto = behaviorProto.Instance.prototype;
	behinstProto.onCreate = function () {
		var speed = this.properties[0];
		this.acc = this.properties[1];
		this.g = this.properties[2];
		this.bounceOffSolid = (this.properties[3] !== 0);
		this.setAngle = (this.properties[4] !== 0);
		this.dx = Math.cos(this.inst.angle) * speed;
		this.dy = Math.sin(this.inst.angle) * speed;
		this.lastx = this.inst.x;
		this.lasty = this.inst.y;
		this.lastKnownAngle = this.inst.angle;
		this.travelled = 0;
		this.enabled = (this.properties[5] !== 0);
	};
	behinstProto.saveToJSON = function () {
		return {
			"acc": this.acc,
			"g": this.g,
			"dx": this.dx,
			"dy": this.dy,
			"lx": this.lastx,
			"ly": this.lasty,
			"lka": this.lastKnownAngle,
			"t": this.travelled,
			"e": this.enabled
		};
	};
	behinstProto.loadFromJSON = function (o) {
		this.acc = o["acc"];
		this.g = o["g"];
		this.dx = o["dx"];
		this.dy = o["dy"];
		this.lastx = o["lx"];
		this.lasty = o["ly"];
		this.lastKnownAngle = o["lka"];
		this.travelled = o["t"];
		this.enabled = o["e"];
	};
	behinstProto.tick = function () {
		if (!this.enabled)
			return;
		var dt = this.runtime.getDt(this.inst);
		var s, a;
		var bounceSolid, bounceAngle;
		if (this.inst.angle !== this.lastKnownAngle) {
			if (this.setAngle) {
				s = cr.distanceTo(0, 0, this.dx, this.dy);
				this.dx = Math.cos(this.inst.angle) * s;
				this.dy = Math.sin(this.inst.angle) * s;
			}
			this.lastKnownAngle = this.inst.angle;
		}
		if (this.acc !== 0) {
			s = cr.distanceTo(0, 0, this.dx, this.dy);
			if (this.dx === 0 && this.dy === 0)
				a = this.inst.angle;
			else
				a = cr.angleTo(0, 0, this.dx, this.dy);
			s += this.acc * dt;
			if (s < 0)
				s = 0;
			this.dx = Math.cos(a) * s;
			this.dy = Math.sin(a) * s;
		}
		if (this.g !== 0)
			this.dy += this.g * dt;
		this.lastx = this.inst.x;
		this.lasty = this.inst.y;
		if (this.dx !== 0 || this.dy !== 0) {
			this.inst.x += this.dx * dt;
			this.inst.y += this.dy * dt;
			this.travelled += cr.distanceTo(0, 0, this.dx * dt, this.dy * dt)
			if (this.setAngle) {
				this.inst.angle = cr.angleTo(0, 0, this.dx, this.dy);
				this.inst.set_bbox_changed();
				this.lastKnownAngle = this.inst.angle;
			}
			this.inst.set_bbox_changed();
			if (this.bounceOffSolid) {
				bounceSolid = this.runtime.testOverlapSolid(this.inst);
				if (bounceSolid) {
					this.runtime.registerCollision(this.inst, bounceSolid);
					s = cr.distanceTo(0, 0, this.dx, this.dy);
					bounceAngle = this.runtime.calculateSolidBounceAngle(this.inst, this.lastx, this.lasty);
					this.dx = Math.cos(bounceAngle) * s;
					this.dy = Math.sin(bounceAngle) * s;
					this.inst.x += this.dx * dt;			// move out for one tick since the object can't have spent a tick in the solid
					this.inst.y += this.dy * dt;
					this.inst.set_bbox_changed();
					if (this.setAngle) {
						this.inst.angle = bounceAngle;
						this.lastKnownAngle = bounceAngle;
						this.inst.set_bbox_changed();
					}
					if (!this.runtime.pushOutSolid(this.inst, this.dx / s, this.dy / s, Math.max(s * 2.5 * dt, 30)))
						this.runtime.pushOutSolidNearest(this.inst, 100);
				}
			}
		}
	};

	function Cnds() {
	};
	Cnds.prototype.CompareSpeed = function (cmp, s) {
		return cr.do_cmp(cr.distanceTo(0, 0, this.dx, this.dy), cmp, s);
	};
	Cnds.prototype.CompareTravelled = function (cmp, d) {
		return cr.do_cmp(this.travelled, cmp, d);
	};
	behaviorProto.cnds = new Cnds();

	function Acts() {
	};
	Acts.prototype.SetSpeed = function (s) {
		var a = cr.angleTo(0, 0, this.dx, this.dy);
		this.dx = Math.cos(a) * s;
		this.dy = Math.sin(a) * s;
	};
	Acts.prototype.SetAcceleration = function (a) {
		this.acc = a;
	};
	Acts.prototype.SetGravity = function (g) {
		this.g = g;
	};
	Acts.prototype.SetAngleOfMotion = function (a) {
		a = cr.to_radians(a);
		var s = cr.distanceTo(0, 0, this.dx, this.dy)
		this.dx = Math.cos(a) * s;
		this.dy = Math.sin(a) * s;
	};
	Acts.prototype.Bounce = function (objtype) {
		if (!objtype)
			return;
		var otherinst = objtype.getFirstPicked(this.inst);
		if (!otherinst)
			return;
		var dt = this.runtime.getDt(this.inst);
		var s = cr.distanceTo(0, 0, this.dx, this.dy);
		var bounceAngle = this.runtime.calculateSolidBounceAngle(this.inst, this.lastx, this.lasty, otherinst);
		this.dx = Math.cos(bounceAngle) * s;
		this.dy = Math.sin(bounceAngle) * s;
		this.inst.x += this.dx * dt;			// move out for one tick since the object can't have spent a tick in the solid
		this.inst.y += this.dy * dt;
		this.inst.set_bbox_changed();
		if (this.setAngle) {
			this.inst.angle = bounceAngle;
			this.lastKnownAngle = bounceAngle;
			this.inst.set_bbox_changed();
		}
		if (this.bounceOffSolid) {
			if (!this.runtime.pushOutSolid(this.inst, this.dx / s, this.dy / s, Math.max(s * 2.5 * dt, 30)))
				this.runtime.pushOutSolidNearest(this.inst, 100);
		}
		else if (s !== 0) {
			this.runtime.pushOut(this.inst, this.dx / s, this.dy / s, Math.max(s * 2.5 * dt, 30), otherinst)
		}
	};
	Acts.prototype.SetDistanceTravelled = function (d) {
		this.travelled = d;
	};
	Acts.prototype.SetEnabled = function (en) {
		this.enabled = (en === 1);
	};
	behaviorProto.acts = new Acts();

	function Exps() {
	};
	Exps.prototype.Speed = function (ret) {
		var s = cr.distanceTo(0, 0, this.dx, this.dy);
		s = cr.round6dp(s);
		ret.set_float(s);
	};
	Exps.prototype.Acceleration = function (ret) {
		ret.set_float(this.acc);
	};
	Exps.prototype.AngleOfMotion = function (ret) {
		ret.set_float(cr.to_degrees(cr.angleTo(0, 0, this.dx, this.dy)));
	};
	Exps.prototype.DistanceTravelled = function (ret) {
		ret.set_float(this.travelled);
	};
	Exps.prototype.Gravity = function (ret) {
		ret.set_float(this.g);
	};
	behaviorProto.exps = new Exps();
}());
;
;
cr.behaviors.Fade = function(runtime)
{
	this.runtime = runtime;
};
(function () {
	var behaviorProto = cr.behaviors.Fade.prototype;
	behaviorProto.Type = function (behavior, objtype) {
		this.behavior = behavior;
		this.objtype = objtype;
		this.runtime = behavior.runtime;
	};
	var behtypeProto = behaviorProto.Type.prototype;
	behtypeProto.onCreate = function () {
	};
	behaviorProto.Instance = function (type, inst) {
		this.type = type;
		this.behavior = type.behavior;
		this.inst = inst;				// associated object instance to modify
		this.runtime = type.runtime;
	};
	var behinstProto = behaviorProto.Instance.prototype;
	behinstProto.onCreate = function () {
		this.activeAtStart = this.properties[0] === 1;
		this.setMaxOpacity = false;					// used to retrieve maxOpacity once in first 'Start fade' action if initially inactive
		this.fadeInTime = this.properties[1];
		this.waitTime = this.properties[2];
		this.fadeOutTime = this.properties[3];
		this.destroy = this.properties[4];			// 0 = no, 1 = after fade out
		this.stage = this.activeAtStart ? 0 : 3;		// 0 = fade in, 1 = wait, 2 = fade out, 3 = done
		if (this.recycled)
			this.stageTime.reset();
		else
			this.stageTime = new cr.KahanAdder();
		this.maxOpacity = (this.inst.opacity ? this.inst.opacity : 1.0);
		if (this.activeAtStart) {
			if (this.fadeInTime === 0) {
				this.stage = 1;
				if (this.waitTime === 0)
					this.stage = 2;
			}
			else {
				this.inst.opacity = 0;
				this.runtime.redraw = true;
			}
		}
	};
	behinstProto.saveToJSON = function () {
		return {
			"fit": this.fadeInTime,
			"wt": this.waitTime,
			"fot": this.fadeOutTime,
			"s": this.stage,
			"st": this.stageTime.sum,
			"mo": this.maxOpacity,
		};
	};
	behinstProto.loadFromJSON = function (o) {
		this.fadeInTime = o["fit"];
		this.waitTime = o["wt"];
		this.fadeOutTime = o["fot"];
		this.stage = o["s"];
		this.stageTime.reset();
		this.stageTime.sum = o["st"];
		this.maxOpacity = o["mo"];
	};
	behinstProto.tick = function () {
		this.stageTime.add(this.runtime.getDt(this.inst));
		if (this.stage === 0) {
			this.inst.opacity = (this.stageTime.sum / this.fadeInTime) * this.maxOpacity;
			this.runtime.redraw = true;
			if (this.inst.opacity >= this.maxOpacity) {
				this.inst.opacity = this.maxOpacity;
				this.stage = 1;	// wait stage
				this.stageTime.reset();
				this.runtime.trigger(cr.behaviors.Fade.prototype.cnds.OnFadeInEnd, this.inst);
			}
		}
		if (this.stage === 1) {
			if (this.stageTime.sum >= this.waitTime) {
				this.stage = 2;	// fade out stage
				this.stageTime.reset();
				this.runtime.trigger(cr.behaviors.Fade.prototype.cnds.OnWaitEnd, this.inst);
			}
		}
		if (this.stage === 2) {
			if (this.fadeOutTime !== 0) {
				this.inst.opacity = this.maxOpacity - ((this.stageTime.sum / this.fadeOutTime) * this.maxOpacity);
				this.runtime.redraw = true;
				if (this.inst.opacity < 0) {
					this.inst.opacity = 0;
					this.stage = 3;	// done
					this.stageTime.reset();
					this.runtime.trigger(cr.behaviors.Fade.prototype.cnds.OnFadeOutEnd, this.inst);
					if (this.destroy === 1)
						this.runtime.DestroyInstance(this.inst);
				}
			}
		}
	};
	behinstProto.doStart = function () {
		this.stage = 0;
		this.stageTime.reset();
		if (this.fadeInTime === 0) {
			this.stage = 1;
			if (this.waitTime === 0)
				this.stage = 2;
		}
		else {
			this.inst.opacity = 0;
			this.runtime.redraw = true;
		}
	};

	function Cnds() {
	};
	Cnds.prototype.OnFadeOutEnd = function () {
		return true;
	};
	Cnds.prototype.OnFadeInEnd = function () {
		return true;
	};
	Cnds.prototype.OnWaitEnd = function () {
		return true;
	};
	behaviorProto.cnds = new Cnds();

	function Acts() {
	};
	Acts.prototype.StartFade = function () {
		if (!this.activeAtStart && !this.setMaxOpacity) {
			this.maxOpacity = (this.inst.opacity ? this.inst.opacity : 1.0);
			this.setMaxOpacity = true;
		}
		if (this.stage === 3)
			this.doStart();
	};
	Acts.prototype.RestartFade = function () {
		this.doStart();
	};
	Acts.prototype.SetFadeInTime = function (t) {
		if (t < 0)
			t = 0;
		this.fadeInTime = t;
	};
	Acts.prototype.SetWaitTime = function (t) {
		if (t < 0)
			t = 0;
		this.waitTime = t;
	};
	Acts.prototype.SetFadeOutTime = function (t) {
		if (t < 0)
			t = 0;
		this.fadeOutTime = t;
	};
	behaviorProto.acts = new Acts();

	function Exps() {
	};
	Exps.prototype.FadeInTime = function (ret) {
		ret.set_float(this.fadeInTime);
	};
	Exps.prototype.WaitTime = function (ret) {
		ret.set_float(this.waitTime);
	};
	Exps.prototype.FadeOutTime = function (ret) {
		ret.set_float(this.fadeOutTime);
	};
	behaviorProto.exps = new Exps();
}());
;
;
cr.behaviors.LOS = function(runtime)
{
	this.runtime = runtime;
};
(function () {
	var behaviorProto = cr.behaviors.LOS.prototype;
	behaviorProto.Type = function (behavior, objtype) {
		this.behavior = behavior;
		this.objtype = objtype;
		this.runtime = behavior.runtime;
	};
	var behtypeProto = behaviorProto.Type.prototype;
	behtypeProto.onCreate = function () {
		this.obstacleTypes = [];						// object types to check for as obstructions
	};
	behtypeProto.findLosBehavior = function (inst) {
		var i, len, b;
		for (i = 0, len = inst.behavior_insts.length; i < len; ++i) {
			b = inst.behavior_insts[i];
			if (b instanceof cr.behaviors.LOS.prototype.Instance && b.type === this)
				return b;
		}
		return null;
	};
	behaviorProto.Instance = function (type, inst) {
		this.type = type;
		this.behavior = type.behavior;
		this.inst = inst;				// associated object instance to modify
		this.runtime = type.runtime;
	};
	var behinstProto = behaviorProto.Instance.prototype;
	behinstProto.onCreate = function () {
		this.obstacleMode = this.properties[0];		// 0 = solids, 1 = custom
		this.range = this.properties[1];
		this.cone = cr.to_radians(this.properties[2]);
		this.useCollisionCells = (this.properties[3] !== 0);
	};
	behinstProto.onDestroy = function () {
	};
	behinstProto.saveToJSON = function () {
		var o = {
			"r": this.range,
			"c": this.cone,
			"t": []
		};
		var i, len;
		for (i = 0, len = this.type.obstacleTypes.length; i < len; i++) {
			o["t"].push(this.type.obstacleTypes[i].sid);
		}
		return o;
	};
	behinstProto.loadFromJSON = function (o) {
		this.range = o["r"];
		this.cone = o["c"];
		cr.clearArray(this.type.obstacleTypes);
		var i, len, t;
		for (i = 0, len = o["t"].length; i < len; i++) {
			t = this.runtime.getObjectTypeBySid(o["t"][i]);
			if (t)
				this.type.obstacleTypes.push(t);
		}
	};
	behinstProto.tick = function () {
	};
	var candidates = [];
	var tmpRect = new cr.rect(0, 0, 0, 0);
	behinstProto.hasLOSto = function (x_, y_) {
		var startx = this.inst.x;
		var starty = this.inst.y;
		var myangle = this.inst.angle;
		if (this.inst.width < 0)
			myangle += Math.PI;
		if (cr.distanceTo(startx, starty, x_, y_) > this.range)
			return false;		// too far away
		var a = cr.angleTo(startx, starty, x_, y_);
		if (cr.angleDiff(myangle, a) > this.cone / 2)
			return false;		// outside cone of view
		var i, leni, rinst, solid;
		tmpRect.set(startx, starty, x_, y_);
		tmpRect.normalize();
		if (this.obstacleMode === 0) {
			if (this.useCollisionCells) {
				this.runtime.getSolidCollisionCandidates(this.inst.layer, tmpRect, candidates);
			}
			else {
				solid = this.runtime.getSolidBehavior();
				if (solid)
					cr.appendArray(candidates, solid.my_instances.valuesRef());
			}
			for (i = 0, leni = candidates.length; i < leni; ++i) {
				rinst = candidates[i];
				if (!rinst.extra["solidEnabled"] || rinst === this.inst)
					continue;
				if (this.runtime.testSegmentOverlap(startx, starty, x_, y_, rinst)) {
					cr.clearArray(candidates);
					return false;
				}
			}
		}
		else {
			if (this.useCollisionCells) {
				this.runtime.getTypesCollisionCandidates(this.inst.layer, this.type.obstacleTypes, tmpRect, candidates);
			}
			else {
				for (i = 0, leni = this.type.obstacleTypes.length; i < leni; ++i) {
					cr.appendArray(candidates, this.type.obstacleTypes[i].instances);
				}
			}
			for (i = 0, leni = candidates.length; i < leni; ++i) {
				rinst = candidates[i];
				if (rinst === this.inst)
					continue;
				if (this.runtime.testSegmentOverlap(startx, starty, x_, y_, rinst)) {
					cr.clearArray(candidates);
					return false;
				}
			}
		}
		cr.clearArray(candidates);
		return true;
	};

	function Cnds() {
	};
	var ltopick = new cr.ObjectSet();
	var rtopick = new cr.ObjectSet();
	Cnds.prototype.HasLOSToObject = function (obj_) {
		if (!obj_)
			return false;
		var i, j, leni, lenj, linst, losbeh, rinst, pick;
		var lsol = this.runtime.getCurrentConditionObjectType().getCurrentSol();
		var rsol = obj_.getCurrentSol();
		var linstances = lsol.getObjects();
		var rinstances = rsol.getObjects();
		if (lsol.select_all)
			cr.clearArray(lsol.else_instances);
		if (rsol.select_all)
			cr.clearArray(rsol.else_instances);
		var inverted = this.runtime.getCurrentCondition().inverted;
		for (i = 0, leni = linstances.length; i < leni; ++i) {
			linst = linstances[i];
			pick = false;
			losbeh = this.findLosBehavior(linst);
			;
			for (j = 0, lenj = rinstances.length; j < lenj; ++j) {
				rinst = rinstances[j];
				if (linst !== rinst && cr.xor(losbeh.hasLOSto(rinst.x, rinst.y), inverted)) {
					pick = true;
					rtopick.add(rinst);
				}
			}
			if (pick)
				ltopick.add(linst);
		}
		var lpicks = ltopick.valuesRef();
		var rpicks = rtopick.valuesRef();
		lsol.select_all = false;
		rsol.select_all = false;
		cr.shallowAssignArray(lsol.instances, lpicks);
		cr.shallowAssignArray(rsol.instances, rpicks);
		ltopick.clear();
		rtopick.clear();
		return lsol.hasObjects();
	};
	Cnds.prototype.HasLOSToPosition = function (x_, y_) {
		return this.hasLOSto(x_, y_);
	};
	behaviorProto.cnds = new Cnds();

	function Acts() {
	};
	Acts.prototype.SetRange = function (r) {
		this.range = r;
	};
	Acts.prototype.SetCone = function (c) {
		this.cone = cr.to_radians(c);
	};
	Acts.prototype.AddObstacle = function (obj_) {
		var obstacleTypes = this.type.obstacleTypes;
		if (obstacleTypes.indexOf(obj_) !== -1)
			return;
		var i, len, t;
		for (i = 0, len = obstacleTypes.length; i < len; i++) {
			t = obstacleTypes[i];
			if (t.is_family && t.members.indexOf(obj_) !== -1)
				return;
		}
		obstacleTypes.push(obj_);
	};
	Acts.prototype.ClearObstacles = function () {
		cr.clearArray(this.type.obstacleTypes);
	};
	behaviorProto.acts = new Acts();

	function Exps() {
	};
	Exps.prototype.Range = function (ret) {
		ret.set_float(this.range);
	};
	Exps.prototype.ConeOfView = function (ret) {
		ret.set_float(cr.to_degrees(this.cone));
	};
	behaviorProto.exps = new Exps();
}());
;
;
cr.behaviors.Pin = function(runtime)
{
	this.runtime = runtime;
};
(function () {
	var behaviorProto = cr.behaviors.Pin.prototype;
	behaviorProto.Type = function (behavior, objtype) {
		this.behavior = behavior;
		this.objtype = objtype;
		this.runtime = behavior.runtime;
	};
	var behtypeProto = behaviorProto.Type.prototype;
	behtypeProto.onCreate = function () {
	};
	behaviorProto.Instance = function (type, inst) {
		this.type = type;
		this.behavior = type.behavior;
		this.inst = inst;				// associated object instance to modify
		this.runtime = type.runtime;
	};
	var behinstProto = behaviorProto.Instance.prototype;
	behinstProto.onCreate = function () {
		this.pinObject = null;
		this.pinObjectUid = -1;		// for loading
		this.pinAngle = 0;
		this.pinDist = 0;
		this.myStartAngle = 0;
		this.theirStartAngle = 0;
		this.lastKnownAngle = 0;
		this.mode = 0;				// 0 = position & angle; 1 = position; 2 = angle; 3 = rope; 4 = bar
		var self = this;
		if (!this.recycled) {
			this.myDestroyCallback = (function (inst) {
				self.onInstanceDestroyed(inst);
			});
		}
		this.runtime.addDestroyCallback(this.myDestroyCallback);
	};
	behinstProto.saveToJSON = function () {
		return {
			"uid": this.pinObject ? this.pinObject.uid : -1,
			"pa": this.pinAngle,
			"pd": this.pinDist,
			"msa": this.myStartAngle,
			"tsa": this.theirStartAngle,
			"lka": this.lastKnownAngle,
			"m": this.mode
		};
	};
	behinstProto.loadFromJSON = function (o) {
		this.pinObjectUid = o["uid"];		// wait until afterLoad to look up
		this.pinAngle = o["pa"];
		this.pinDist = o["pd"];
		this.myStartAngle = o["msa"];
		this.theirStartAngle = o["tsa"];
		this.lastKnownAngle = o["lka"];
		this.mode = o["m"];
	};
	behinstProto.afterLoad = function () {
		if (this.pinObjectUid === -1)
			this.pinObject = null;
		else {
			this.pinObject = this.runtime.getObjectByUID(this.pinObjectUid);
			;
		}
		this.pinObjectUid = -1;
	};
	behinstProto.onInstanceDestroyed = function (inst) {
		if (this.pinObject == inst)
			this.pinObject = null;
	};
	behinstProto.onDestroy = function () {
		this.pinObject = null;
		this.runtime.removeDestroyCallback(this.myDestroyCallback);
	};
	behinstProto.tick = function () {
	};
	behinstProto.tick2 = function () {
		if (!this.pinObject)
			return;
		if (this.lastKnownAngle !== this.inst.angle)
			this.myStartAngle = cr.clamp_angle(this.myStartAngle + (this.inst.angle - this.lastKnownAngle));
		var newx = this.inst.x;
		var newy = this.inst.y;
		if (this.mode === 3 || this.mode === 4)		// rope mode or bar mode
		{
			var dist = cr.distanceTo(this.inst.x, this.inst.y, this.pinObject.x, this.pinObject.y);
			if ((dist > this.pinDist) || (this.mode === 4 && dist < this.pinDist)) {
				var a = cr.angleTo(this.pinObject.x, this.pinObject.y, this.inst.x, this.inst.y);
				newx = this.pinObject.x + Math.cos(a) * this.pinDist;
				newy = this.pinObject.y + Math.sin(a) * this.pinDist;
			}
		}
		else {
			newx = this.pinObject.x + Math.cos(this.pinObject.angle + this.pinAngle) * this.pinDist;
			newy = this.pinObject.y + Math.sin(this.pinObject.angle + this.pinAngle) * this.pinDist;
		}
		var newangle = cr.clamp_angle(this.myStartAngle + (this.pinObject.angle - this.theirStartAngle));
		this.lastKnownAngle = newangle;
		if ((this.mode === 0 || this.mode === 1 || this.mode === 3 || this.mode === 4)
			&& (this.inst.x !== newx || this.inst.y !== newy)) {
			this.inst.x = newx;
			this.inst.y = newy;
			this.inst.set_bbox_changed();
		}
		if ((this.mode === 0 || this.mode === 2) && (this.inst.angle !== newangle)) {
			this.inst.angle = newangle;
			this.inst.set_bbox_changed();
		}
	};

	function Cnds() {
	};
	Cnds.prototype.IsPinned = function () {
		return !!this.pinObject;
	};
	behaviorProto.cnds = new Cnds();

	function Acts() {
	};
	Acts.prototype.Pin = function (obj, mode_) {
		if (!obj)
			return;
		var otherinst = obj.getFirstPicked(this.inst);
		if (!otherinst)
			return;
		this.pinObject = otherinst;
		this.pinAngle = cr.angleTo(otherinst.x, otherinst.y, this.inst.x, this.inst.y) - otherinst.angle;
		this.pinDist = cr.distanceTo(otherinst.x, otherinst.y, this.inst.x, this.inst.y);
		this.myStartAngle = this.inst.angle;
		this.lastKnownAngle = this.inst.angle;
		this.theirStartAngle = otherinst.angle;
		this.mode = mode_;
	};
	Acts.prototype.Unpin = function () {
		this.pinObject = null;
	};
	behaviorProto.acts = new Acts();

	function Exps() {
	};
	Exps.prototype.PinnedUID = function (ret) {
		ret.set_int(this.pinObject ? this.pinObject.uid : -1);
	};
	behaviorProto.exps = new Exps();
}());
;
;
cr.behaviors.Rex_MoveTo = function(runtime)
{
	this.runtime = runtime;
};
(function () {
	var behaviorProto = cr.behaviors.Rex_MoveTo.prototype;
	behaviorProto.Type = function (behavior, objtype) {
		this.behavior = behavior;
		this.objtype = objtype;
		this.runtime = behavior.runtime;
	};
	var behtypeProto = behaviorProto.Type.prototype;
	behtypeProto.onCreate = function () {
	};
	behaviorProto.Instance = function (type, inst) {
		this.type = type;
		this.behavior = type.behavior;
		this.inst = inst;				// associated object instance to modify
		this.runtime = type.runtime;
	};
	var behinstProto = behaviorProto.Instance.prototype;
	behinstProto.onCreate = function () {
		this.enabled = (this.properties[0] === 1);
		if (!this.recycled) {
			this.moveParams = {};
		}
		this.moveParams["max"] = this.properties[1];
		this.moveParams["acc"] = this.properties[2];
		this.moveParams["dec"] = this.properties[3];
		this.soildStopEnable = (this.properties[4] === 1);
		this.isContinueMode = (this.properties[5] === 1);
		if (!this.recycled) {
			this.target = {"x": 0, "y": 0, "a": 0};
		}
		this.isMoving = false;
		this.currentSpeed = 0;
		this.remainDistance = 0;
		this.remainDt = 0;
		if (!this.recycled) {
			this.prePosition = {"x": 0, "y": 0};
		}
		this.prePosition["x"] = 0;
		this.prePosition["y"] = 0;
		this.movingAngleData = newPointData(this.movingAngleData);
		this.movingAngleStartData = newPointData(this.movingAngleStartData);
		this.lastTick = null;
		this.isMyCall = false;
	};
	var newPointData = function (point) {
		if (point == null)
			point = {};
		point["x"] = 0;
		point["y"] = 0;
		point["a"] = -1;
		return point;
	};
	behinstProto.tick = function () {
		this.remainDt = 0;
		if ((!this.enabled) || (!this.isMoving))
			return;
		var dt = this.runtime.getDt(this.inst);
		this.move(dt);
	};
	behinstProto.move = function (dt) {
		if (dt == 0)   // can not move if dt == 0
			return;
		if ((this.prePosition["x"] !== this.inst.x) || (this.prePosition["y"] !== this.inst.y))
			this.resetCurrentPosition();    // reset this.remainDistance
		var isSlowDown = false;
		if (this.moveParams["dec"] != 0) {
			var d = (this.currentSpeed * this.currentSpeed) / (2 * this.moveParams["dec"]); // (v*v)/(2*a)
			isSlowDown = (d >= this.remainDistance);
		}
		var acc = (isSlowDown) ? (-this.moveParams["dec"]) : this.moveParams["acc"];
		if (acc != 0) {
			this.setCurrentSpeed(this.currentSpeed + (acc * dt));
		}
		var distance = this.currentSpeed * dt;
		this.remainDistance -= distance;
		var isHitTarget = false;
		var angle = this.target["a"];
		var ux = Math.cos(angle);
		var uy = Math.sin(angle);
		if ((this.remainDistance <= 0) || (this.currentSpeed <= 0)) {
			isHitTarget = true;
			this.inst.x = this.target["x"];
			this.inst.y = this.target["y"];
			if (this.currentSpeed > 0)
				this.remainDt = (-this.remainDistance) / this.currentSpeed;
			this.getMovingAngle();
			this.setCurrentSpeed(0);
		}
		else {
			var angle = this.target["a"];
			this.inst.x += (distance * ux);
			this.inst.y += (distance * uy);
		}
		this.inst.set_bbox_changed();
		var isSolidStop = false;
		if (this.soildStopEnable) {
			var collobj = this.runtime.testOverlapSolid(this.inst);
			if (collobj) {
				this.runtime.registerCollision(this.inst, collobj);
				this.runtime.pushOutSolid(this.inst, -ux, -uy, Math.max(distance, 50));
				isSolidStop = true;
			}
		}
		this.prePosition["x"] = this.inst.x;
		this.prePosition["y"] = this.inst.y;
		if (isSolidStop) {
			this.isMoving = false;  // stop
			this.isMyCall = true;
			this.runtime.trigger(cr.behaviors.Rex_MoveTo.prototype.cnds.OnSolidStop, this.inst);
			this.isMyCall = false;
		}
		else if (isHitTarget) {
			this.isMoving = false;  // stop
			this.isMyCall = true;
			this.runtime.trigger(cr.behaviors.Rex_MoveTo.prototype.cnds.OnHitTarget, this.inst);
			this.isMyCall = false;
		}
	};
	behinstProto.tick2 = function () {
		this.movingAngleData["x"] = this.inst.x;
		this.movingAngleData["y"] = this.inst.y;
	};
	behinstProto.setCurrentSpeed = function (speed) {
		if (speed != null) {
			this.currentSpeed = (speed > this.moveParams["max"]) ?
				this.moveParams["max"] : speed;
		}
		else if (this.moveParams["acc"] == 0) {
			this.currentSpeed = this.moveParams["max"];
		}
	};
	behinstProto.resetCurrentPosition = function () {
		var dx = this.target["x"] - this.inst.x;
		var dy = this.target["y"] - this.inst.y;
		this.target["a"] = Math.atan2(dy, dx);
		this.remainDistance = Math.sqrt((dx * dx) + (dy * dy));
		this.prePosition["x"] = this.inst.x;
		this.prePosition["y"] = this.inst.y;
	};
	behinstProto.setTargetPos = function (_x, _y) {
		this.target["x"] = _x;
		this.target["y"] = _y;
		this.setCurrentSpeed(null);
		this.resetCurrentPosition();
		this.movingAngleData["x"] = this.inst.x;
		this.movingAngleData["y"] = this.inst.y;
		this.isMoving = true;
		this.movingAngleStartData["x"] = this.inst.x;
		this.movingAngleStartData["y"] = this.inst.y;
		this.movingAngleStartData["a"] = cr.to_clamped_degrees(cr.angleTo(this.inst.x, this.inst.y, _x, _y));
		if (this.isContinueMode)
			this.move(this.remainDt);
	};
	behinstProto.isTickChanged = function () {
		var curTick = this.runtime.tickcount;
		var tickChanged = (this.lastTick != curTick);
		this.lastTick = curTick;
		return tickChanged;
	};
	behinstProto.getMovingAngle = function (ret) {
		if (this.isTickChanged()) {
			var dx = this.inst.x - this.movingAngleData["x"];
			var dy = this.inst.y - this.movingAngleData["y"];
			if ((dx != 0) || (dy != 0))
				this.movingAngleData["a"] = cr.to_clamped_degrees(Math.atan2(dy, dx));
		}
		return this.movingAngleData["a"];
	};

	function clone(obj) {
		if (null == obj || "object" != typeof obj)
			return obj;
		var result = obj.constructor();
		for (var attr in obj) {
			if (obj.hasOwnProperty(attr))
				result[attr] = obj[attr];
		}
		return result;
	};
	behinstProto.saveToJSON = function () {
		return {
			"en": this.enabled,
			"v": clone(this.moveParams),
			"t": clone(this.target),
			"is_m": this.isMoving,
			"c_spd": this.currentSpeed,
			"rd": this.remainDistance,
			"pp": clone(this.prePosition),
			"ma": clone(this.movingAngleData),
			"ms": clone(this.movingAngleStartData),
			"lt": this.lastTick,
		};
	};
	behinstProto.loadFromJSON = function (o) {
		this.enabled = o["en"];
		this.moveParams = o["v"];
		this.target = o["t"];
		this.isMoving = o["is_m"];
		this.currentSpeed = o["c_spd"];
		this.remainDistance = o["rd"];
		this.prePosition = o["pp"];
		this.movingAngleData = o["ma"];
		this.movingAngleStartData = o["ms"];
		this.lastTick = o["lt"];
	};

	function Cnds() {
	};
	behaviorProto.cnds = new Cnds();
	Cnds.prototype.OnHitTarget = function () {
		return (this.isMyCall);
	};
	Cnds.prototype.CompareSpeed = function (cmp, s) {
		return cr.do_cmp(this.currentSpeed, cmp, s);
	};
	Cnds.prototype.OnMoving = function ()  // deprecated
	{
		return false;
	};
	Cnds.prototype.IsMoving = function () {
		return (this.enabled && this.isMoving);
	};
	Cnds.prototype.CompareMovingAngle = function (cmp, s) {
		var angle = this.getMovingAngle();
		if (angle != (-1))
			return cr.do_cmp(this.getMovingAngle(), cmp, s);
		else
			return false;
	};
	Cnds.prototype.OnSolidStop = function () {
		return this.isMyCall;
	};

	function Acts() {
	};
	behaviorProto.acts = new Acts();
	Acts.prototype.SetEnabled = function (en) {
		this.enabled = (en === 1);
	};
	Acts.prototype.SetMaxSpeed = function (s) {
		this.moveParams["max"] = s;
		this.setCurrentSpeed(null);
	};
	Acts.prototype.SetAcceleration = function (a) {
		this.moveParams["acc"] = a;
		this.setCurrentSpeed(null);
	};
	Acts.prototype.SetDeceleration = function (a) {
		this.moveParams["dec"] = a;
	};
	Acts.prototype.SetTargetPos = function (x, y) {
		this.setTargetPos(x, y)
	};
	Acts.prototype.SetCurrentSpeed = function (s) {
		this.setCurrentSpeed(s);
	};
	Acts.prototype.SetTargetPosOnObject = function (objtype) {
		if (!objtype)
			return;
		var inst = objtype.getFirstPicked();
		if (inst != null)
			this.setTargetPos(inst.x, inst.y);
	};
	Acts.prototype.SetTargetPosByDeltaXY = function (dx, dy) {
		this.setTargetPos(this.inst.x + dx, this.inst.y + dy);
	};
	Acts.prototype.SetTargetPosByDistanceAngle = function (distance, angle) {
		var a = cr.to_clamped_radians(angle);
		var dx = distance * Math.cos(a);
		var dy = distance * Math.sin(a);
		this.setTargetPos(this.inst.x + dx, this.inst.y + dy);
	};
	Acts.prototype.Stop = function () {
		this.isMoving = false;
	};
	Acts.prototype.SetTargetPosOnUID = function (uid) {
		var inst = this.runtime.getObjectByUID(uid);
		if (inst != null)
			this.setTargetPos(inst.x, inst.y);
	};
	Acts.prototype.SetStopBySolid = function (en) {
		this.soildStopEnable = (en === 1);
	};

	function Exps() {
	};
	behaviorProto.exps = new Exps();
	Exps.prototype.Activated = function (ret) {
		ret.set_int((this.enabled) ? 1 : 0);
	};
	Exps.prototype.Speed = function (ret) {
		ret.set_float(this.currentSpeed);
	};
	Exps.prototype.MaxSpeed = function (ret) {
		ret.set_float(this.moveParams["max"]);
	};
	Exps.prototype.Acc = function (ret) {
		ret.set_float(this.moveParams["acc"]);
	};
	Exps.prototype.Dec = function (ret) {
		ret.set_float(this.moveParams["dec"]);
	};
	Exps.prototype.TargetX = function (ret) {
		ret.set_float(this.target["x"]);
	};
	Exps.prototype.TargetY = function (ret) {
		ret.set_float(this.target["y"]);
	};
	Exps.prototype.MovingAngle = function (ret) {
		ret.set_float(this.getMovingAngle());
	};
	Exps.prototype.MovingAngleStart = function (ret) {
		ret.set_float(this.movingAngleStartData["a"]);
	};
}());
cr.behaviors.Rex_RotateTo = function(runtime)
{
	this.runtime = runtime;
};
(function () {
	var behaviorProto = cr.behaviors.Rex_RotateTo.prototype;
	behaviorProto.Type = function (behavior, objtype) {
		this.behavior = behavior;
		this.objtype = objtype;
		this.runtime = behavior.runtime;
	};
	var behtypeProto = behaviorProto.Type.prototype;
	behtypeProto.onCreate = function () {
	};
	behaviorProto.Instance = function (type, inst) {
		this.type = type;
		this.behavior = type.behavior;
		this.inst = inst;				// associated object instance to modify
		this.runtime = type.runtime;
	};
	var behinstProto = behaviorProto.Instance.prototype;
	behinstProto.onCreate = function () {
		this.activated = (this.properties[0] == 1);
		this.move = {
			"max": this.properties[1],
			"acc": this.properties[2],
			"dec": this.properties[3]
		};
		this.target = {"a": 0, "cw": true};
		this.is_rotating = false;
		this.current_speed = 0;
		this.remain_distance = 0;
		this.is_my_call = false;
	};
	behinstProto.tick = function () {
		if ((!this.activated) || (!this.is_rotating)) {
			return;
		}
		var dt = this.runtime.getDt(this.inst);
		if (dt == 0)   // can not move if dt == 0
			return;
		var is_slow_down = false;
		if (this.move["dec"] != 0) {
			var _speed = this.current_speed;
			var _distance = (_speed * _speed) / (2 * this.move["dec"]); // (v*v)/(2*a)
			is_slow_down = (_distance >= this.remain_distance);
		}
		var acc = (is_slow_down) ? (-this.move["dec"]) : this.move["acc"];
		if (acc != 0) {
			this.SetCurrentSpeed(this.current_speed + (acc * dt));
		}
		var distance = this.current_speed * dt;
		this.remain_distance -= distance;
		var is_hit_target = false;
		if ((this.remain_distance <= 0) || (this.current_speed <= 0)) {
			this.is_rotating = false;
			this.inst.angle = cr.to_clamped_radians(this.target["a"]);
			this.SetCurrentSpeed(0);
			is_hit_target = true;
		}
		else {
			if (this.target["cw"])
				this.inst.angle += cr.to_clamped_radians(distance);
			else
				this.inst.angle -= cr.to_clamped_radians(distance);
		}
		this.inst.set_bbox_changed();
		if (is_hit_target) {
			this.is_my_call = true;
			this.runtime.trigger(cr.behaviors.Rex_RotateTo.prototype.cnds.OnHitTarget, this.inst);
			this.is_my_call = false;
		}
	};
	behinstProto.tick2 = function () {
	};
	behinstProto.SetCurrentSpeed = function (speed) {
		if (speed != null) {
			this.current_speed = (speed > this.move["max"]) ?
				this.move["max"] : speed;
		}
		else if (this.move["acc"] == 0) {
			this.current_speed = this.move["max"];
		}
	};
	behinstProto.SetTargetAngle = function (target_angle_radians, clockwise_mode)  // in radians
	{
		this.is_rotating = true;
		var cur_angle_radians = this.inst.angle;
		this.target["cw"] = (clockwise_mode == 2) ? cr.angleClockwise(target_angle_radians, cur_angle_radians) :
			(clockwise_mode == 1);
		var remain_distance = (clockwise_mode == 2) ? cr.angleDiff(cur_angle_radians, target_angle_radians) :
			(clockwise_mode == 1) ? (target_angle_radians - cur_angle_radians) :
				(cur_angle_radians - target_angle_radians);
		this.remain_distance = cr.to_clamped_degrees(remain_distance);
		this.target["a"] = cr.to_clamped_degrees(target_angle_radians);
		this.SetCurrentSpeed(null);
	};
	behinstProto.saveToJSON = function () {
		return {
			"en": this.activated,
			"v": this.move,
			"t": this.target,
			"ir": this.is_rotating,
			"cs": this.current_speed,
			"rd": this.remain_distance
		};
	};
	behinstProto.loadFromJSON = function (o) {
		this.activated = o["en"];
		this.move = o["v"];
		this.target = o["t"];
		this.is_rotating = o["ir"];
		this.current_speed = o["cs"];
		this.remain_distance = o["rd"];
	};

	function Cnds() {
	};
	behaviorProto.cnds = new Cnds();
	Cnds.prototype.OnHitTarget = function () {
		return (this.is_my_call);
	};
	Cnds.prototype.CompareSpeed = function (cmp, s) {
		return cr.do_cmp(this.current_speed, cmp, s);
	};
	Cnds.prototype.OnMoving = function ()  // deprecated
	{
		return false;
	};
	Cnds.prototype.IsRotating = function () {
		return (this.activated && this.is_rotating);
	};

	function Acts() {
	};
	behaviorProto.acts = new Acts();
	Acts.prototype.SetActivated = function (s) {
		this.activated = (s == 1);
	};
	Acts.prototype.SetMaxSpeed = function (s) {
		this.move["max"] = s;
		this.SetCurrentSpeed(null);
	};
	Acts.prototype.SetAcceleration = function (a) {
		this.move["acc"] = a;
		this.SetCurrentSpeed(null);
	};
	Acts.prototype.SetDeceleration = function (a) {
		this.move["dec"] = a;
	};
	Acts.prototype.SetTargetAngle = function (angle, clockwise_mode) {
		this.SetTargetAngle(cr.to_clamped_radians(angle), clockwise_mode)
	};
	Acts.prototype.SetCurrentSpeed = function (s) {
		this.SetCurrentSpeed(s);
	};
	Acts.prototype.SetTargetAngleOnObject = function (objtype, clockwise_mode) {
		if (!objtype)
			return;
		var inst = objtype.getFirstPicked();
		if (inst != null) {
			var angle = Math.atan2(inst.y - this.inst.y, inst.x - this.inst.x);
			this.SetTargetAngle(angle, clockwise_mode);
		}
	};
	Acts.prototype.SetTargetAngleByDeltaAngle = function (dA, clockwise_mode) {
		var dA_rad = cr.to_clamped_radians(dA);
		if (clockwise_mode == 0)
			dA_rad = -dA_rad;
		var angle = this.inst.angle + dA_rad;
		this.SetTargetAngle(angle, clockwise_mode);
	};
	Acts.prototype.SetTargetAngleToPos = function (tx, ty, clockwise_mode) {
		var angle = Math.atan2(ty - this.inst.y, tx - this.inst.x);
		this.SetTargetAngle(angle, clockwise_mode);
	};
	Acts.prototype.Stop = function () {
		this.is_rotating = false;
	};

	function Exps() {
	};
	behaviorProto.exps = new Exps();
	Exps.prototype.Activated = function (ret) {
		ret.set_int((this.activated) ? 1 : 0);
	};
	Exps.prototype.Speed = function (ret) {
		ret.set_float(this.current_speed);
	};
	Exps.prototype.MaxSpeed = function (ret) {
		ret.set_float(this.move["max"]);
	};
	Exps.prototype.Acc = function (ret) {
		ret.set_float(this.move["acc"]);
	};
	Exps.prototype.Dec = function (ret) {
		ret.set_float(this.move["dec"]);
	};
	Exps.prototype.TargetAngle = function (ret) {
		var x = (this.is_rotating) ? this.target["a"] : 0;
		ret.set_float(x);
	};
}())

cr.behaviors.Sin = function(runtime)
{
	this.runtime = runtime;
};
(function () {
	var behaviorProto = cr.behaviors.Sin.prototype;
	behaviorProto.Type = function (behavior, objtype) {
		this.behavior = behavior;
		this.objtype = objtype;
		this.runtime = behavior.runtime;
	};
	var behtypeProto = behaviorProto.Type.prototype;
	behtypeProto.onCreate = function () {
	};
	behaviorProto.Instance = function (type, inst) {
		this.type = type;
		this.behavior = type.behavior;
		this.inst = inst;				// associated object instance to modify
		this.runtime = type.runtime;
		this.i = 0;		// period offset (radians)
	};
	var behinstProto = behaviorProto.Instance.prototype;
	var _2pi = 2 * Math.PI;
	var _pi_2 = Math.PI / 2;
	var _3pi_2 = (3 * Math.PI) / 2;
	behinstProto.onCreate = function () {
		this.active = (this.properties[0] === 1);
		this.movement = this.properties[1]; // 0=Horizontal|1=Vertical|2=Size|3=Width|4=Height|5=Angle|6=Opacity|7=Value only
		this.wave = this.properties[2];		// 0=Sine|1=Triangle|2=Sawtooth|3=Reverse sawtooth|4=Square
		this.period = this.properties[3];
		this.period += Math.random() * this.properties[4];								// period random
		if (this.period === 0)
			this.i = 0;
		else {
			this.i = (this.properties[5] / this.period) * _2pi;								// period offset
			this.i += ((Math.random() * this.properties[6]) / this.period) * _2pi;			// period offset random
		}
		this.mag = this.properties[7];													// magnitude
		this.mag += Math.random() * this.properties[8];									// magnitude random
		this.initialValue = 0;
		this.initialValue2 = 0;
		this.ratio = 0;
		this.init();
	};
	behinstProto.saveToJSON = function () {
		return {
			"i": this.i,
			"a": this.active,
			"mv": this.movement,
			"w": this.wave,
			"p": this.period,
			"mag": this.mag,
			"iv": this.initialValue,
			"iv2": this.initialValue2,
			"r": this.ratio,
			"lkv": this.lastKnownValue,
			"lkv2": this.lastKnownValue2
		};
	};
	behinstProto.loadFromJSON = function (o) {
		this.i = o["i"];
		this.active = o["a"];
		this.movement = o["mv"];
		this.wave = o["w"];
		this.period = o["p"];
		this.mag = o["mag"];
		this.initialValue = o["iv"];
		this.initialValue2 = o["iv2"] || 0;
		this.ratio = o["r"];
		this.lastKnownValue = o["lkv"];
		this.lastKnownValue2 = o["lkv2"] || 0;
	};
	behinstProto.init = function () {
		switch (this.movement) {
			case 0:		// horizontal
				this.initialValue = this.inst.x;
				break;
			case 1:		// vertical
				this.initialValue = this.inst.y;
				break;
			case 2:		// size
				this.initialValue = this.inst.width;
				this.ratio = this.inst.height / this.inst.width;
				break;
			case 3:		// width
				this.initialValue = this.inst.width;
				break;
			case 4:		// height
				this.initialValue = this.inst.height;
				break;
			case 5:		// angle
				this.initialValue = this.inst.angle;
				this.mag = cr.to_radians(this.mag);		// convert magnitude from degrees to radians
				break;
			case 6:		// opacity
				this.initialValue = this.inst.opacity;
				break;
			case 7:
				this.initialValue = 0;
				break;
			case 8:		// forwards/backwards
				this.initialValue = this.inst.x;
				this.initialValue2 = this.inst.y;
				break;
			default:
				;
		}
		this.lastKnownValue = this.initialValue;
		this.lastKnownValue2 = this.initialValue2;
	};
	behinstProto.waveFunc = function (x) {
		x = x % _2pi;
		switch (this.wave) {
			case 0:		// sine
				return Math.sin(x);
			case 1:		// triangle
				if (x <= _pi_2)
					return x / _pi_2;
				else if (x <= _3pi_2)
					return 1 - (2 * (x - _pi_2) / Math.PI);
				else
					return (x - _3pi_2) / _pi_2 - 1;
			case 2:		// sawtooth
				return 2 * x / _2pi - 1;
			case 3:		// reverse sawtooth
				return -2 * x / _2pi + 1;
			case 4:		// square
				return x < Math.PI ? -1 : 1;
		}
		;
		return 0;
	};
	behinstProto.tick = function () {
		var dt = this.runtime.getDt(this.inst);
		if (!this.active || dt === 0)
			return;
		if (this.period === 0)
			this.i = 0;
		else {
			this.i += (dt / this.period) * _2pi;
			this.i = this.i % _2pi;
		}
		this.updateFromPhase();
	};
	behinstProto.updateFromPhase = function () {
		switch (this.movement) {
			case 0:		// horizontal
				if (this.inst.x !== this.lastKnownValue)
					this.initialValue += this.inst.x - this.lastKnownValue;
				this.inst.x = this.initialValue + this.waveFunc(this.i) * this.mag;
				this.lastKnownValue = this.inst.x;
				break;
			case 1:		// vertical
				if (this.inst.y !== this.lastKnownValue)
					this.initialValue += this.inst.y - this.lastKnownValue;
				this.inst.y = this.initialValue + this.waveFunc(this.i) * this.mag;
				this.lastKnownValue = this.inst.y;
				break;
			case 2:		// size
				this.inst.width = this.initialValue + this.waveFunc(this.i) * this.mag;
				this.inst.height = this.inst.width * this.ratio;
				break;
			case 3:		// width
				this.inst.width = this.initialValue + this.waveFunc(this.i) * this.mag;
				break;
			case 4:		// height
				this.inst.height = this.initialValue + this.waveFunc(this.i) * this.mag;
				break;
			case 5:		// angle
				if (this.inst.angle !== this.lastKnownValue)
					this.initialValue = cr.clamp_angle(this.initialValue + (this.inst.angle - this.lastKnownValue));
				this.inst.angle = cr.clamp_angle(this.initialValue + this.waveFunc(this.i) * this.mag);
				this.lastKnownValue = this.inst.angle;
				break;
			case 6:		// opacity
				this.inst.opacity = this.initialValue + (this.waveFunc(this.i) * this.mag) / 100;
				if (this.inst.opacity < 0)
					this.inst.opacity = 0;
				else if (this.inst.opacity > 1)
					this.inst.opacity = 1;
				break;
			case 8:		// forwards/backwards
				if (this.inst.x !== this.lastKnownValue)
					this.initialValue += this.inst.x - this.lastKnownValue;
				if (this.inst.y !== this.lastKnownValue2)
					this.initialValue2 += this.inst.y - this.lastKnownValue2;
				this.inst.x = this.initialValue + Math.cos(this.inst.angle) * this.waveFunc(this.i) * this.mag;
				this.inst.y = this.initialValue2 + Math.sin(this.inst.angle) * this.waveFunc(this.i) * this.mag;
				this.lastKnownValue = this.inst.x;
				this.lastKnownValue2 = this.inst.y;
				break;
		}
		this.inst.set_bbox_changed();
	};
	behinstProto.onSpriteFrameChanged = function (prev_frame, next_frame) {
		switch (this.movement) {
			case 2:	// size
				this.initialValue *= (next_frame.width / prev_frame.width);
				this.ratio = next_frame.height / next_frame.width;
				break;
			case 3:	// width
				this.initialValue *= (next_frame.width / prev_frame.width);
				break;
			case 4:	// height
				this.initialValue *= (next_frame.height / prev_frame.height);
				break;
		}
	};

	function Cnds() {
	};
	Cnds.prototype.IsActive = function () {
		return this.active;
	};
	Cnds.prototype.CompareMovement = function (m) {
		return this.movement === m;
	};
	Cnds.prototype.ComparePeriod = function (cmp, v) {
		return cr.do_cmp(this.period, cmp, v);
	};
	Cnds.prototype.CompareMagnitude = function (cmp, v) {
		if (this.movement === 5)
			return cr.do_cmp(this.mag, cmp, cr.to_radians(v));
		else
			return cr.do_cmp(this.mag, cmp, v);
	};
	Cnds.prototype.CompareWave = function (w) {
		return this.wave === w;
	};
	behaviorProto.cnds = new Cnds();

	function Acts() {
	};
	Acts.prototype.SetActive = function (a) {
		this.active = (a === 1);
	};
	Acts.prototype.SetPeriod = function (x) {
		this.period = x;
	};
	Acts.prototype.SetMagnitude = function (x) {
		this.mag = x;
		if (this.movement === 5)	// angle
			this.mag = cr.to_radians(this.mag);
	};
	Acts.prototype.SetMovement = function (m) {
		if (this.movement === 5)
			this.mag = cr.to_degrees(this.mag);
		this.movement = m;
		this.init();
	};
	Acts.prototype.SetWave = function (w) {
		this.wave = w;
	};
	Acts.prototype.SetPhase = function (x) {
		this.i = (x * _2pi) % _2pi;
		this.updateFromPhase();
	};
	Acts.prototype.UpdateInitialState = function () {
		this.init();
	};
	behaviorProto.acts = new Acts();

	function Exps() {
	};
	Exps.prototype.CyclePosition = function (ret) {
		ret.set_float(this.i / _2pi);
	};
	Exps.prototype.Period = function (ret) {
		ret.set_float(this.period);
	};
	Exps.prototype.Magnitude = function (ret) {
		if (this.movement === 5)	// angle
			ret.set_float(cr.to_degrees(this.mag));
		else
			ret.set_float(this.mag);
	};
	Exps.prototype.Value = function (ret) {
		ret.set_float(this.waveFunc(this.i) * this.mag);
	};
	behaviorProto.exps = new Exps();
}());

cr.behaviors.Timer = function(runtime)
{
	this.runtime = runtime;
};
(function () {
	var behaviorProto = cr.behaviors.Timer.prototype;
	behaviorProto.Type = function (behavior, objtype) {
		this.behavior = behavior;
		this.objtype = objtype;
		this.runtime = behavior.runtime;
	};
	var behtypeProto = behaviorProto.Type.prototype;
	behtypeProto.onCreate = function () {
	};
	behaviorProto.Instance = function (type, inst) {
		this.type = type;
		this.behavior = type.behavior;
		this.inst = inst;				// associated object instance to modify
		this.runtime = type.runtime;
	};
	var behinstProto = behaviorProto.Instance.prototype;
	behinstProto.onCreate = function () {
		this.timers = {};
	};
	behinstProto.onDestroy = function () {
		cr.wipe(this.timers);
	};
	behinstProto.saveToJSON = function () {
		var o = {};
		var p, t;
		for (p in this.timers) {
			if (this.timers.hasOwnProperty(p)) {
				t = this.timers[p];
				o[p] = {
					"c": t.current.sum,
					"t": t.total.sum,
					"d": t.duration,
					"r": t.regular
				};
			}
		}
		return o;
	};
	behinstProto.loadFromJSON = function (o) {
		this.timers = {};
		var p;
		for (p in o) {
			if (o.hasOwnProperty(p)) {
				this.timers[p] = {
					current: new cr.KahanAdder(),
					total: new cr.KahanAdder(),
					duration: o[p]["d"],
					regular: o[p]["r"]
				};
				this.timers[p].current.sum = o[p]["c"];
				this.timers[p].total.sum = o[p]["t"];
			}
		}
	};
	behinstProto.tick = function () {
		var dt = this.runtime.getDt(this.inst);
		var p, t;
		for (p in this.timers) {
			if (this.timers.hasOwnProperty(p)) {
				t = this.timers[p];
				t.current.add(dt);
				t.total.add(dt);
			}
		}
	};
	behinstProto.tick2 = function () {
		var p, t;
		for (p in this.timers) {
			if (this.timers.hasOwnProperty(p)) {
				t = this.timers[p];
				if (t.current.sum >= t.duration) {
					if (t.regular)
						t.current.sum -= t.duration;
					else
						delete this.timers[p];
				}
			}
		}
	};

	function Cnds() {
	};
	Cnds.prototype.OnTimer = function (tag_) {
		tag_ = tag_.toLowerCase();
		var t = this.timers[tag_];
		if (!t)
			return false;
		return t.current.sum >= t.duration;
	};
	behaviorProto.cnds = new Cnds();

	function Acts() {
	};
	Acts.prototype.StartTimer = function (duration_, type_, tag_) {
		this.timers[tag_.toLowerCase()] = {
			current: new cr.KahanAdder(),
			total: new cr.KahanAdder(),
			duration: duration_,
			regular: (type_ === 1)
		};
	};
	Acts.prototype.StopTimer = function (tag_) {
		tag_ = tag_.toLowerCase();
		if (this.timers.hasOwnProperty(tag_))
			delete this.timers[tag_];
	};
	behaviorProto.acts = new Acts();

	function Exps() {
	};
	Exps.prototype.CurrentTime = function (ret, tag_) {
		var t = this.timers[tag_.toLowerCase()];
		ret.set_float(t ? t.current.sum : 0);
	};
	Exps.prototype.TotalTime = function (ret, tag_) {
		var t = this.timers[tag_.toLowerCase()];
		ret.set_float(t ? t.total.sum : 0);
	};
	Exps.prototype.Duration = function (ret, tag_) {
		var t = this.timers[tag_.toLowerCase()];
		ret.set_float(t ? t.duration : 0);
	};
	behaviorProto.exps = new Exps();
}());

function trim (str) {
	return str.replace(/^\s\s*/, '').replace(/\s\s*$/, '');
}
cr.behaviors.lunarray_Tween = function(runtime)
{
	this.runtime = runtime;
};
(function () {
	var behaviorProto = cr.behaviors.lunarray_Tween.prototype;
	behaviorProto.Type = function (behavior, objtype) {
		this.behavior = behavior;
		this.objtype = objtype;
		this.runtime = behavior.runtime;
	};
	var behtypeProto = behaviorProto.Type.prototype;
	behtypeProto.onCreate = function () {
	};
	behaviorProto.Instance = function (type, inst) {
		this.type = type;
		this.behavior = type.behavior;
		this.inst = inst;				// associated object instance to modify
		this.runtime = type.runtime;
		this.i = 0;		// progress
	};
	var behinstProto = behaviorProto.Instance.prototype;
	behinstProto.groupUpdateProgress = function (v) {
		if (v > 1) v = 1;
		if (cr.lunarray_tweenProgress[this.group] = -1) cr.lunarray_tweenProgress[this.group] = v;
		if (cr.lunarray_tweenProgress[this.group] >= v) cr.lunarray_tweenProgress[this.group] = v;
	}
	behinstProto.groupSync = function () {
		if (this.group != "") {
			if (typeof cr.lunarray_tweenGroup === "undefined") {
				cr.lunarray_tweenGroup = {};
				cr.lunarray_tweenProgress = {};
			}
			if (typeof cr.lunarray_tweenGroup[this.group] === "undefined") {
				cr.lunarray_tweenGroup[this.group] = [];
				cr.lunarray_tweenProgress[this.group] = -1;
			}
			if (cr.lunarray_tweenGroup[this.group].indexOf(this) == -1) {
				cr.lunarray_tweenGroup[this.group].push(this);
			}
		}
	}
	behinstProto.saveState = function () {
		this.tweenSaveWidth = this.inst.width;
		this.tweenSaveHeight = this.inst.height;
		this.tweenSaveAngle = this.inst.angle;
		this.tweenSaveOpacity = this.inst.opacity;
		this.tweenSaveX = this.inst.x;
		this.tweenSaveY = this.inst.y;
		this.tweenSaveValue = this.value;
	}
	behinstProto.onCreate = function () {
		this.active = (this.properties[0] === 1);
		this.tweened = this.properties[1]; // 0=Position|1=Size|2=Width|3=Height|4=Angle|5=Opacity|6=Value only|7=Pixel Size
		this.easing = this.properties[2];
		this.initial = this.properties[3];
		this.target = this.properties[4];
		this.duration = this.properties[5];
		this.wait = this.properties[6];
		this.playmode = this.properties[7]; //0=Play Once|1=Repeat|2=Ping Pong|3=Play once and destroy|4=Loop|5=Ping Pong Stop|6=Play and stop
		this.value = this.properties[8];
		this.coord_mode = this.properties[9]; //0=Absolute|1=Relative
		this.forceInit = (this.properties[10] === 1);
		this.group = this.properties[11];
		this.targetObject = null;
		this.pingpongCounter = 0;
		if (this.playmode == 5) this.pingpongCounter = 1;
		this.groupSync();
		this.isPaused = false;
		this.initialX = this.inst.x;
		this.initialY = this.inst.y;
		this.targetX = parseFloat(this.target.split(",")[0]);
		this.targetY = parseFloat(this.target.split(",")[1]);
		this.saveState();
		this.tweenInitialX = 0;
		this.tweenInitialY = 0;
		this.tweenTargetX = 0;
		this.tweenTargetY = 0;
		this.tweenTargetAngle = 0;
		this.ratio = this.inst.height / this.inst.width;
		this.reverse = false;
		this.rewindMode = false;
		this.doTweenX = true;
		this.doTweenY = true;
		this.loop = false;
		this.initiating = 0;
		this.cooldown = 0;
		this.lastPlayMode = this.playmode;
		this.lastKnownValue = this.tweenInitialX;
		this.lastKnownX = this.tweenInitialX;
		this.lastKnownY = this.tweenInitialY;
		if (this.forceInit) this.init();
		if (this.initial == "") this.initial = "current";
		this.onStarted = false;
		this.onStartedDone = false;
		this.onWaitEnd = false;
		this.onWaitEndDone = false;
		this.onEnd = false;
		this.onEndDone = false;
		this.onCooldown = false;
		this.onCooldownDone = false;
		if (this.active) {
			this.init();
		}
	};
	behinstProto.init = function () {
		this.onStarted = false;
		if (this.initial === "") this.initial = "current";
		if (this.target === "") this.target = "current";
		var isCurrent = (this.initial === "current");
		var targetIsCurrent = (this.target === "current");
		var isTargettingObject = (this.target === "OBJ");
		if (this.target === "OBJ") {
			if (this.targetObject != null) {
				if (this.tweened == 0) {
					if (this.coord_mode == 1) //relative mode
						this.target = (this.targetObject.x - this.inst.x) + "," + (this.targetObject.y - this.inst.y);
					else //absolute mode
						this.target = (this.targetObject.x) + "," + (this.targetObject.y);
				} else if ((this.tweened == 1) || (this.tweened == 2) || (this.tweened == 3) || (this.tweened == 7)) {
					if (this.coord_mode == 1) { //relative mode
						this.target = ((this.tweened == 2) ? 1 : (this.targetObject.width)) + "," + ((this.tweened == 3) ? 1 : (this.targetObject.height));
					} else {
						this.target = ((this.tweened == 2) ? 1 : (this.targetObject.width / this.tweenSaveWidth)) + "," + ((this.tweened == 3) ? 1 : (this.targetObject.height / this.tweenSaveHeight));
					}
				} else if (this.tweened == 4) {
					if (this.coord_mode == 1) //relative mode
						this.target = cr.to_degrees(this.targetObject.angle - this.inst.angle) + "";
					else //absolute mode
						this.target = cr.to_degrees(this.targetObject.angle) + "";
				} else if (this.tweened == 5) {
					if (this.coord_mode == 1) //relative mode
						this.target = ((this.targetObject.opacity - this.inst.opacity) * 100) + "";
					else //absolute mode
						this.target = (this.targetObject.opacity * 100) + "";
				}
			}
		}
		if (this.tweened == 0) {
			if (targetIsCurrent) this.target = this.inst.x + "," + this.inst.y;
			if (!isCurrent) {
				if (!this.reverse) {
					if (this.playmode != 1) {
						this.inst.x = parseFloat(this.initial.split(",")[0]);
						this.inst.y = parseFloat(this.initial.split(",")[1]);
					}
				}
			} else {
				if (this.coord_mode == 1) {
					this.initial = this.inst.x + "," + this.inst.y;
				} else {
					this.initial = this.tweenSaveX + "," + this.tweenSaveY;
				}
			}
			if (this.coord_mode == 1) {
				if (this.loop) {
					this.inst.x = this.tweenSaveX;
					this.inst.y = this.tweenSaveY;
				}
				this.initialX = this.inst.x;
				this.initialY = this.inst.y;
				if (!this.reverse) {
					this.targetX = parseFloat(this.target.split(",")[0]);
					this.targetY = parseFloat(this.target.split(",")[1]);
				} else {
					this.targetX = -parseFloat(this.target.split(",")[0]);
					this.targetY = -parseFloat(this.target.split(",")[1]);
				}
				this.tweenInitialX = this.initialX;
				this.tweenInitialY = this.initialY;
				this.tweenTargetX = this.tweenInitialX + this.targetX;
				this.tweenTargetY = this.tweenInitialY + this.targetY;
			} else {
				if (!this.reverse) {
					this.inst.x = this.tweenSaveX;
					this.inst.y = this.tweenSaveY;
					this.targetX = parseFloat(this.target.split(",")[0]);
					this.targetY = parseFloat(this.target.split(",")[1]);
				} else {
					this.inst.x = parseFloat(this.target.split(",")[0]);
					this.inst.y = parseFloat(this.target.split(",")[1]);
					this.targetX = this.tweenSaveX;
					this.targetY = this.tweenSaveY;
				}
				this.initialX = this.inst.x;
				this.initialY = this.inst.y;
				this.tweenInitialX = this.initialX;
				this.tweenInitialY = this.initialY;
				this.tweenTargetX = this.targetX;
				this.tweenTargetY = this.targetY;
				if (this.playmode == -6) {
					this.tweenTargetX = this.tweenSaveX;
					this.tweenTargetY = this.tweenSaveY;
				}
			}
		} else if ((this.tweened == 1) || (this.tweened == 2) || (this.tweened == 3)) {
			if (targetIsCurrent) this.target = "1,1";
			if (this.initial == "current") this.initial = "1,1";
			this.initial = "" + this.initial;
			this.target = "" + this.target;
			if (this.tweened == 2) {
				if (this.initial.indexOf(',') == -1) this.initial = parseFloat(this.initial) + ",1";
				if (this.target.indexOf(',') == -1) this.target = parseFloat(this.target) + ",1";
			} else if (this.tweened == 3) {
				if (this.initial.indexOf(',') == -1) this.initial = "1," + parseFloat(this.initial);
				if (this.target.indexOf(',') == -1) this.target = "1," + parseFloat(this.target);
			} else {
				if (this.initial.indexOf(',') == -1) this.initial = parseFloat(this.initial) + "," + parseFloat(this.initial);
				if (this.target.indexOf(',') == -1) this.target = parseFloat(this.target) + "," + parseFloat(this.target);
			}
			var ix = parseFloat(this.initial.split(",")[0]);
			var iy = parseFloat(this.initial.split(",")[1]);
			this.doTweenX = true;
			var tx = parseFloat(this.target.split(",")[0]);
			if ((tx == 0) || (isNaN(tx))) this.doTweenX = false;
			if (this.tweened == 3) this.doTweenX = false;
			this.doTweenY = true;
			var ty = parseFloat(this.target.split(",")[1]);
			if ((ty == 0) || (isNaN(ty))) this.doTweenY = false;
			if (this.tweened == 2) this.doTweenY = false;
			if (this.coord_mode == 1) {
				if (this.loop) {
					this.inst.width = this.tweenSaveWidth;
					this.inst.height = this.tweenSaveHeight;
				}
				if (!isCurrent) {
					if (!this.reverse) {
						this.inst.width = this.inst.width * ix;
						this.inst.height = this.inst.height * iy;
					} else {
						this.inst.width = this.inst.width * tx;
						this.inst.height = this.inst.height * ty;
					}
				}
				this.initialX = this.inst.width;
				this.initialY = this.inst.height;
				this.tweenInitialX = this.initialX;
				this.tweenInitialY = this.initialY;
				if (!this.reverse) {
					this.targetX = this.initialX * tx;
					this.targetY = this.initialY * ty;
				} else {
					this.targetX = this.initialX * ix / tx;
					this.targetY = this.initialY * iy / ty;
				}
				this.tweenTargetX = this.targetX;
				this.tweenTargetY = this.targetY;
			} else {
				if (!isCurrent) {
					if (!this.reverse) {
						this.inst.width = this.tweenSaveWidth * ix;
						this.inst.height = this.tweenSaveHeight * iy;
					} else {
						this.inst.width = this.tweenSaveWidth * tx;
						this.inst.height = this.tweenSaveHeight * ty;
					}
				}
				this.initialX = this.inst.width;
				this.initialY = this.inst.height;
				this.tweenInitialX = this.initialX;
				this.tweenInitialY = this.initialY;
				if (!this.reverse) {
					this.targetX = this.tweenSaveWidth * tx;
					this.targetY = this.tweenSaveHeight * ty;
				} else {
					this.targetX = this.tweenSaveWidth * ix;
					this.targetY = this.tweenSaveHeight * iy;
				}
				this.tweenTargetX = this.targetX;
				this.tweenTargetY = this.targetY;
			}
			if (this.playmode == -6) {
				this.tweenTargetX = this.tweenSaveWidth * ix;
				this.tweenTargetY = this.tweenSaveHeight * iy;
			}
		} else if (this.tweened == 4) {
			if (targetIsCurrent) this.target = cr.to_degrees(this.inst.angle);
			if (this.initial != "current") {
				if (!this.reverse) {
					if (this.playmode != 1) { //if repeat, don't initialize
						this.inst.angle = cr.to_radians(parseFloat(this.initial.split(",")[0]));
					}
				}
			}
			if (this.coord_mode == 1) {
				if (this.loop) {
					this.inst.angle = this.tweenSaveAngle;
				}
				this.initialX = this.inst.angle;
				if (this.reverse) {
					this.targetX = this.inst.angle - cr.to_radians(parseFloat(this.target.split(",")[0]));
				} else {
					this.targetX = this.inst.angle + cr.to_radians(parseFloat(this.target.split(",")[0]));
				}
				this.tweenInitialX = this.initialX;
				this.tweenTargetX = cr.to_degrees(this.targetX);
			} else {
				if (this.reverse) {
					this.inst.angle = cr.to_radians(parseFloat(this.target.split(",")[0]));
					;
					this.initialX = this.inst.angle;
					this.targetX = this.tweenSaveAngle;
					this.tweenInitialX = this.initialX;
					this.tweenTargetX = cr.to_degrees(this.targetX);
				} else {
					this.inst.angle = this.tweenSaveAngle;
					this.initialX = this.inst.angle;
					this.targetX = cr.to_radians(parseFloat(this.target.split(",")[0]));
					this.tweenInitialX = this.initialX;
					this.tweenTargetX = cr.to_degrees(this.targetX);
				}
			}
			if (this.playmode == -6) {
				this.tweenTargetX = cr.to_degrees(this.tweenSaveAngle);
			}
			this.tweenTargetAngle = cr.to_radians(this.tweenTargetX);
		} else if (this.tweened == 5) {
			if (this.initial == "current") this.initial = this.inst.opacity;
			if (targetIsCurrent) this.target = "" + this.inst.opacity;
			if (!isCurrent) {
				if (!this.reverse) {
					if (this.playmode != 1) { //if repeat, don't initialize
						this.inst.opacity = parseFloat(this.initial.split(",")[0]) / 100;
					}
				}
			}
			if (this.coord_mode == 1) {
				if (this.loop) {
					this.inst.opacity = this.tweenSaveOpacity;
				}
				this.initialX = this.inst.opacity;
				this.tweenInitialX = this.initialX;
				if (!this.reverse) {
					this.targetX = parseFloat(this.target.split(",")[0]) / 100;
				} else {
					this.targetX = -parseFloat(this.target.split(",")[0]) / 100;
				}
				this.tweenTargetX = this.tweenInitialX + this.targetX;
			} else {
				this.initialX = this.inst.opacity;
				if (!this.reverse) {
					this.tweenInitialX = this.initialX;
					this.targetX = parseFloat(this.target.split(",")[0]) / 100;
				} else {
					this.tweenInitialX = parseFloat(this.target.split(",")[0]) / 100;
					this.targetX = parseFloat(this.initial.split(",")[0]) / 100;
				}
				this.tweenTargetX = this.targetX;
			}
			if (this.playmode == -6) {
				this.tweenTargetX = this.tweenSaveOpacity;
			}
		} else if (this.tweened == 6) {
			if (isNaN(this.value)) this.value = 0;
			if (this.initial == "current") this.initial = "" + this.value;
			if (targetIsCurrent) this.target = "" + this.value;
			if (!isCurrent) {
				if (!this.reverse) {
					if (this.playmode != 1) { //if repeat, don't initialize
						this.value = parseFloat(this.initial.split(",")[0]);
					}
				}
			}
			if (this.coord_mode == 1) {
				if (this.loop) {
					this.value = this.tweenSaveValue;
				}
				if (!isCurrent) {
					if (!this.reverse) {
						this.value = parseFloat(this.initial.split(",")[0]);
					} else {
						this.value = parseFloat(this.target.split(",")[0]);
					}
				}
				this.initialX = this.value;
				if (!this.reverse) {
					this.targetX = this.initialX + parseFloat(this.target.split(",")[0]);
				} else {
					this.targetX = this.initialX - parseFloat(this.target.split(",")[0]);
				}
				this.tweenInitialX = this.initialX;
				this.tweenTargetX = this.targetX;
			} else {
				if (!isCurrent) {
					if (!this.reverse) {
						this.value = parseFloat(this.initial.split(",")[0]);
					} else {
						this.value = parseFloat(this.target.split(",")[0]);
					}
				}
				this.initialX = this.value;
				if (!this.reverse) {
					this.targetX = parseFloat(this.target.split(",")[0]);
				} else {
					this.targetX = parseFloat(this.initial.split(",")[0]);
				}
				this.tweenInitialX = this.initialX;
				this.tweenTargetX = this.targetX;
			}
			if (this.playmode == -6) {
				this.tweenTargetX = this.tweenSaveValue;
			}
		} else if (this.tweened == 7) {
			if (targetIsCurrent) this.target = this.inst.width + "," + this.inst.height;
			if (this.initial != "current") {
				if (!this.reverse) {
					if (this.playmode != 1) { //if repeat, don't initialize
						this.inst.width = parseFloat(this.initial.split(",")[0]);
						this.inst.height = parseFloat(this.initial.split(",")[1]);
					}
				}
			}
			this.doTweenX = true;
			var tx = parseFloat(this.target.split(",")[0]);
			if ((tx < 0) || (isNaN(tx))) this.doTweenX = false;
			this.doTweenY = true;
			var ty = parseFloat(this.target.split(",")[1]);
			if ((ty < 0) || (isNaN(ty))) this.doTweenY = false;
			if (this.coord_mode == 1) {
				if (this.loop) {
					this.inst.width = this.tweenSaveWidth;
					this.inst.height = this.tweenSaveHeight;
				}
				this.initialX = this.inst.width;
				this.initialY = this.inst.height;
				if (!this.reverse) {
					this.targetX = this.initialX + parseFloat(this.target.split(",")[0]);
					this.targetY = this.initialY + parseFloat(this.target.split(",")[1]);
				} else {
					this.targetX = this.initialX - parseFloat(this.target.split(",")[0]);
					this.targetY = this.initialY - parseFloat(this.target.split(",")[1]);
				}
				this.tweenInitialX = this.initialX;
				this.tweenInitialY = this.initialY;
				this.tweenTargetX = this.targetX;
				this.tweenTargetY = this.targetY;
			} else {
				if (!isCurrent) {
					if (!this.reverse) {
						this.inst.width = this.tweenSaveWidth;
						this.inst.height = this.tweenSaveHeight;
					} else {
						this.inst.width = parseFloat(this.target.split(",")[0]);
						this.inst.height = parseFloat(this.target.split(",")[1]);
					}
				}
				this.initialX = this.inst.width;
				this.initialY = this.inst.height;
				if (!this.reverse) {
					this.targetX = parseFloat(this.target.split(",")[0]);
					this.targetY = parseFloat(this.target.split(",")[1]);
				} else {
					this.targetX = this.tweenSaveWidth;
					this.targetY = this.tweenSaveHeight;
				}
				this.tweenInitialX = this.initialX;
				this.tweenInitialY = this.initialY;
				this.tweenTargetX = this.targetX;
				this.tweenTargetY = this.targetY;
			}
			if (this.playmode == -6) {
				this.tweenTargetX = this.tweenSaveWidth;
				this.tweenTargetY = this.tweenSaveHeight;
			}
		} else {
			;
		}
		this.lastKnownValue = this.tweenInitialX;
		this.lastKnownX = this.tweenInitialX;
		this.lastKnownY = this.tweenInitialY;
		this.initiating = parseFloat(this.wait.split(",")[0]);
		this.cooldown = parseFloat(this.wait.split(",")[1]);
		if ((this.initiating < 0) || (isNaN(this.initiating))) this.initiating = 0;
		if ((this.cooldown < 0) || (isNaN(this.cooldown))) this.cooldown = 0;
		if (isCurrent) this.initial = "current";
		if (targetIsCurrent) this.target = "current";
		if (isTargettingObject) this.target = "OBJ";
	};

	function easeOutBounce(t, b, c, d) {
		if ((t /= d) < (1 / 2.75)) {
			return c * (7.5625 * t * t) + b;
		} else if (t < (2 / 2.75)) {
			return c * (7.5625 * (t -= (1.5 / 2.75)) * t + .75) + b;
		} else if (t < (2.5 / 2.75)) {
			return c * (7.5625 * (t -= (2.25 / 2.75)) * t + .9375) + b;
		} else {
			return c * (7.5625 * (t -= (2.625 / 2.75)) * t + .984375) + b;
		}
	}

	behinstProto.easeFunc = function (t, b, c, d) {
		switch (this.easing) {
			case 0:		// linear
				return c * t / d + b;
			case 1:		// easeInQuad
				return c * (t /= d) * t + b;
			case 2:		// easeOutQuad
				return -c * (t /= d) * (t - 2) + b;
			case 3:		// easeInOutQuad
				if ((t /= d / 2) < 1) return c / 2 * t * t + b;
				return -c / 2 * ((--t) * (t - 2) - 1) + b;
			case 4:		// easeInCubic
				return c * (t /= d) * t * t + b;
			case 5:		// easeOutCubic
				return c * ((t = t / d - 1) * t * t + 1) + b;
			case 6:		// easeInOutCubic
				if ((t /= d / 2) < 1)
					return c / 2 * t * t * t + b;
				return c / 2 * ((t -= 2) * t * t + 2) + b;
			case 7:		// easeInQuart
				return c * (t /= d) * t * t * t + b;
			case 8:		// easeOutQuart
				return -c * ((t = t / d - 1) * t * t * t - 1) + b;
			case 9:		// easeInOutQuart
				if ((t /= d / 2) < 1) return c / 2 * t * t * t * t + b;
				return -c / 2 * ((t -= 2) * t * t * t - 2) + b;
			case 10:		// easeInQuint
				return c * (t /= d) * t * t * t * t + b;
			case 11:		// easeOutQuint
				return c * ((t = t / d - 1) * t * t * t * t + 1) + b;
			case 12:		// easeInOutQuint
				if ((t /= d / 2) < 1) return c / 2 * t * t * t * t * t + b;
				return c / 2 * ((t -= 2) * t * t * t * t + 2) + b;
			case 13:		// easeInCircle
				return -c * (Math.sqrt(1 - (t /= d) * t) - 1) + b;
			case 14:		// easeOutCircle
				return c * Math.sqrt(1 - (t = t / d - 1) * t) + b;
			case 15:		// easeInOutCircle
				if ((t /= d / 2) < 1) return -c / 2 * (Math.sqrt(1 - t * t) - 1) + b;
				return c / 2 * (Math.sqrt(1 - (t -= 2) * t) + 1) + b;
			case 16:		// easeInBack
				var s = 0;
				if (s == 0) s = 1.70158;
				return c * (t /= d) * t * ((s + 1) * t - s) + b;
			case 17:		// easeOutBack
				var s = 0;
				if (s == 0) s = 1.70158;
				return c * ((t = t / d - 1) * t * ((s + 1) * t + s) + 1) + b;
			case 18:		// easeInOutBack
				var s = 0;
				if (s == 0) s = 1.70158;
				if ((t /= d / 2) < 1) return c / 2 * (t * t * (((s *= (1.525)) + 1) * t - s)) + b;
				return c / 2 * ((t -= 2) * t * (((s *= (1.525)) + 1) * t + s) + 2) + b;
			case 19:	//easeInElastic
				var a = 0;
				var p = 0;
				if (t == 0) return b;
				if ((t /= d) == 1) return b + c;
				if (p == 0) p = d * .3;
				if (a == 0 || a < Math.abs(c)) {
					a = c;
					var s = p / 4;
				}
				else var s = p / (2 * Math.PI) * Math.asin(c / a);
				return -(a * Math.pow(2, 10 * (t -= 1)) * Math.sin((t * d - s) * (2 * Math.PI) / p)) + b;
			case 20:	//easeOutElastic
				var a = 0;
				var p = 0;
				if (t == 0) return b;
				if ((t /= d) == 1) return b + c;
				if (p == 0) p = d * .3;
				if (a == 0 || a < Math.abs(c)) {
					a = c;
					var s = p / 4;
				}
				else var s = p / (2 * Math.PI) * Math.asin(c / a);
				return (a * Math.pow(2, -10 * t) * Math.sin((t * d - s) * (2 * Math.PI) / p) + c + b);
			case 21:	//easeInOutElastic
				var a = 0;
				var p = 0;
				if (t == 0) return b;
				if ((t /= d / 2) == 2) return b + c;
				if (p == 0) p = d * (.3 * 1.5);
				if (a == 0 || a < Math.abs(c)) {
					a = c;
					var s = p / 4;
				}
				else var s = p / (2 * Math.PI) * Math.asin(c / a);
				if (t < 1) return -.5 * (a * Math.pow(2, 10 * (t -= 1)) * Math.sin((t * d - s) * (2 * Math.PI) / p)) + b;
				return a * Math.pow(2, -10 * (t -= 1)) * Math.sin((t * d - s) * (2 * Math.PI) / p) * .5 + c + b;
			case 22:	//easeInBounce
				return c - easeOutBounce(d - t, 0, c, d) + b;
			case 23:	//easeOutBounce
				return easeOutBounce(t, b, c, d);
			case 24:	//easeInOutBounce
				if (t < d / 2) return (c - easeOutBounce(d - (t * 2), 0, c, d) + b) * 0.5 + b;
				else return easeOutBounce(t * 2 - d, 0, c, d) * .5 + c * .5 + b;
			case 25:	//easeInSmoothstep
				var mt = (t / d) / 2;
				return (2 * (mt * mt * (3 - 2 * mt)));
			case 26:	//easeOutSmoothstep
				var mt = ((t / d) + 1) / 2;
				return ((2 * (mt * mt * (3 - 2 * mt))) - 1);
			case 27:	//easeInOutSmoothstep
				var mt = (t / d);
				return (mt * mt * (3 - 2 * mt));
		}
		;
		return 0;
	};
	behinstProto.saveToJSON = function () {
		return {
			"i": this.i,
			"active": this.active,
			"tweened": this.tweened,
			"easing": this.easing,
			"initial": this.initial,
			"target": this.target,
			"duration": this.duration,
			"wait": this.wait,
			"playmode": this.playmode,
			"value": this.value,
			"coord_mode": this.coord_mode,
			"forceInit": this.forceInit,
			"group": this.group,
			"targetObject": this.targetObject,
			"pingpongCounter": this.pingpongCounter,
			"isPaused": this.isPaused,
			"initialX": this.initialX,
			"initialY": this.initialY,
			"targetX": this.targetX,
			"targetY": this.targetY,
			"tweenSaveWidth": this.tweenSaveWidth,
			"tweenSaveHeight": this.tweenSaveHeight,
			"tweenSaveAngle": this.tweenSaveAngle,
			"tweenSaveX": this.tweenSaveX,
			"tweenSaveY": this.tweenSaveY,
			"tweenSaveValue": this.tweenSaveValue,
			"tweenInitialX": this.tweenInitialX,
			"tweenInitialY": this.tweenInitialY,
			"tweenTargetX": this.tweenTargetX,
			"tweenTargetY": this.tweenTargetY,
			"tweenTargetAngle": this.tweenTargetAngle,
			"ratio": this.ratio,
			"reverse": this.reverse,
			"rewindMode": this.rewindMode,
			"doTweenX": this.doTweenX,
			"doTweenY": this.doTweenY,
			"loop": this.loop,
			"initiating": this.initiating,
			"cooldown": this.cooldown,
			"lastPlayMode": this.lastPlayMode,
			"lastKnownValue": this.lastKnownValue,
			"lastKnownX": this.lastKnownX,
			"lastKnownY": this.lastKnownY,
			"onStarted": this.onStarted,
			"onStartedDone": this.onStartedDone,
			"onWaitEnd": this.onWaitEnd,
			"onWaitEndDone": this.onWaitEndDone,
			"onEnd": this.onEnd,
			"onEndDone": this.onEndDone,
			"onCooldown": this.onCooldown,
			"onCooldownDone": this.onCooldownDone
		};
	};
	behinstProto.loadFromJSON = function (o) {
		this.i = o["i"];
		this.active = o["active"];
		this.tweened = o["tweened"];
		this.easing = o["easing"];
		this.initial = o["initial"];
		this.target = o["target"];
		this.duration = o["duration"];
		this.wait = o["wait"];
		this.playmode = o["playmode"];
		this.value = o["value"];
		this.coord_mode = o["coord_mode"];
		this.forceInit = o["forceInit"];
		this.group = o["group"];
		this.targetObject = o["targetObject"];
		this.pingpongCounter = o["pingpongCounter"];
		this.isPaused = o["isPaused"];
		this.initialX = o["initialX"];
		this.initialY = o["initialY"];
		this.targetX = o["targetX"];
		this.targetY = o["targetY"];
		this.tweenSaveWidth = o["tweenSaveWidth"];
		this.tweenSaveHeight = o["tweenSaveHeight"];
		this.tweenSaveAngle = o["tweenSaveAngle"];
		this.tweenSaveX = o["tweenSaveX"];
		this.tweenSaveY = o["tweenSaveY"];
		this.tweenSaveValue = o["tweenSaveValue"];
		this.tweenInitialX = o["tweenInitialX"];
		this.tweenInitialY = o["tweenInitialY"];
		this.tweenTargetX = o["tweenTargetX"];
		this.tweenTargetY = o["tweenTargetY"];
		this.tweenTargetAngle = o["tweenTargetAngle"];
		this.ratio = o["ratio"];
		this.reverse = o["reverse"];
		this.rewindMode = o["rewindMode"];
		this.doTweenX = o["doTweenX"];
		this.doTweenY = o["doTweenY"];
		this.loop = o["loop"];
		this.initiating = o["initiating"];
		this.cooldown = o["cooldown"];
		this.lastPlayMode = o["lastPlayMode"];
		this.lastKnownValue = o["lastKnownValue"];
		this.lastKnownX = o["lastKnownX"];
		this.lastKnownY = o["lastKnownY"];
		this.onStarted = o["onStarted"];
		this.onStartedDone = o["onStartedDone"];
		this.onWaitEnd = o["onWaitEnd"];
		this.onWaitEndDone = o["onWaitEndDone"]
		this.onEnd = o["onEnd"];
		this.onEndDone = o["onEndDone"];
		this.onCooldown = o["onCooldown"];
		this.onCooldownDone = o["onCooldownDone"];
		this.groupSync();
	};
	behinstProto.tick = function () {
		var dt = this.runtime.getDt(this.inst);
		var isForceStop = (this.i == -1);
		if (!this.active || dt === 0)
			return;
		if (this.i == 0) {
			if (!this.onStarted) {
				this.onStarted = true;
				this.onStartedDone = false;
				this.onWaitEnd = false;
				this.onWaitEndDone = false;
				this.onEnd = false;
				this.onEndDone = false;
				this.onCooldown = false;
				this.onCooldownDone = false;
				this.runtime.trigger(cr.behaviors.lunarray_Tween.prototype.cnds.OnStart, this.inst);
				this.onStartedDone = true;
			}
		}
		if (this.i == -1) {
			this.i = this.initiating + this.duration + this.cooldown;
		} else {
			this.i += dt;
		}
		if (this.i <= this.initiating) {
			return;
		} else {
			if (this.onWaitEnd == false) {
				this.onWaitEnd = true;
				this.runtime.trigger(cr.behaviors.lunarray_Tween.prototype.cnds.OnWaitEnd, this.inst);
				this.onWaitEndDone = true;
			}
		}
		if (this.i <= (this.duration + this.initiating)) {
			var factor = this.easeFunc(this.i - this.initiating, 0, 1, this.duration);
			if (this.tweened == 0) {
				if (this.coord_mode == 1) {
					if (this.inst.x !== this.lastKnownX) {
						this.tweenInitialX += (this.inst.x - this.lastKnownX);
						this.tweenTargetX += (this.inst.x - this.lastKnownX);
					}
					if (this.inst.y !== this.lastKnownY) {
						this.tweenInitialY += (this.inst.y - this.lastKnownY);
						this.tweenTargetY += (this.inst.y - this.lastKnownY);
					}
				} else {
					if (this.inst.x !== this.lastKnownX)
						this.tweenInitialX += (this.inst.x - this.lastKnownX);
					if (this.inst.y !== this.lastKnownY)
						this.tweenInitialY += (this.inst.y - this.lastKnownY);
				}
				this.inst.x = this.tweenInitialX + (this.tweenTargetX - this.tweenInitialX) * factor;
				this.inst.y = this.tweenInitialY + (this.tweenTargetY - this.tweenInitialY) * factor;
				this.lastKnownX = this.inst.x;
				this.lastKnownY = this.inst.y;
			} else if ((this.tweened == 1) || (this.tweened == 2) || (this.tweened == 3)) {
				if (this.inst.width !== this.lastKnownX)
					this.tweenInitialX = this.inst.width;
				if (this.inst.height !== this.lastKnownY)
					this.tweenInitialY = this.inst.height;
				if (this.doTweenX) {
					this.inst.width = this.tweenInitialX + (this.tweenTargetX - this.tweenInitialX) * factor;
				}
				if (this.doTweenY) {
					this.inst.height = this.tweenInitialY + (this.tweenTargetY - this.tweenInitialY) * factor;
				} else {
					if (this.tweened == 1) {
						this.inst.height = this.inst.width * this.ratio;
					}
				}
				this.lastKnownX = this.inst.width;
				this.lastKnownY = this.inst.height;
			} else if (this.tweened == 4) {
				var tangle = this.tweenInitialX + (this.tweenTargetAngle - this.tweenInitialX) * factor;
				if (this.i >= (this.duration + this.initiating))
					tangle = this.tweenTargetAngle;
				this.inst.angle = cr.clamp_angle(tangle);
			} else if (this.tweened == 5) {
				if (this.coord_mode == 1) {
					if (this.inst.opacity !== this.lastKnownX)
						this.tweenInitialX = this.inst.opacity;
				}
				this.inst.opacity = this.tweenInitialX + (this.tweenTargetX - this.tweenInitialX) * factor;
				this.lastKnownX = this.inst.opacity;
			} else if (this.tweened == 6) {
				this.value = this.tweenInitialX + (this.tweenTargetX - this.tweenInitialX) * factor;
			} else if (this.tweened == 7) {
				if (this.coord_mode == 1) {
					if (this.inst.width !== this.lastKnownX)
						this.tweenInitialX = this.inst.width;
					if (this.inst.height !== this.lastKnownY)
						this.tweenInitialY = this.inst.height;
				}
				if (this.doTweenX) this.inst.width = this.tweenInitialX + (this.tweenTargetX - this.tweenInitialX) * factor;
				if (this.doTweenY) this.inst.height = this.tweenInitialY + (this.tweenTargetY - this.tweenInitialY) * factor;
				this.lastKnownX = this.inst.width;
				this.lastKnownY = this.inst.height;
			}
			this.inst.set_bbox_changed();
		}
		if (this.i >= this.duration + this.initiating) {
			this.doEndFrame(isForceStop);
			this.inst.set_bbox_changed();
			if (this.onEnd == false) {
				this.onEnd = true;
				this.runtime.trigger(cr.behaviors.lunarray_Tween.prototype.cnds.OnEnd, this.inst);
				this.onEndDone = true;
			}
		}
		;
	};
	behinstProto.doEndFrame = function (isForceStop) {
		switch (this.tweened) {
			case 0:		// position
				this.inst.x = this.tweenTargetX;
				this.inst.y = this.tweenTargetY;
				break;
			case 1:		// size
				if (this.doTweenX) this.inst.width = this.tweenTargetX;
				if (this.doTweenY) {
					this.inst.height = this.tweenTargetY;
				} else {
					this.inst.height = this.inst.width * this.ratio;
				}
				break;
			case 2:		// width
				this.inst.width = this.tweenTargetX;
				break;
			case 3:		// height
				this.inst.height = this.tweenTargetY;
				break;
			case 4:		// angle
				var tangle = this.tweenTargetAngle;
				this.inst.angle = cr.clamp_angle(tangle);
				this.lastKnownValue = this.inst.angle;
				break;
			case 5:		// opacity
				this.inst.opacity = this.tweenTargetX;
				break;
			case 6:		// value
				this.value = this.tweenTargetX;
				break;
			case 7:		// size
				if (this.doTweenX) this.inst.width = this.tweenTargetX;
				if (this.doTweenY) this.inst.height = this.tweenTargetY;
				break;
		}
		if (this.i >= this.duration + this.initiating + this.cooldown) {
			if (this.playmode == 0) {
				this.active = false;
				this.reverse = false;
				this.i = this.duration + this.initiating + this.cooldown;
			} else if (this.playmode == 1) {
				this.i = 0;
				this.init();
				this.active = true;
			} else if (this.playmode == 2) {
				if (isForceStop) {
					this.reverse = false;
					this.init();
				} else {
					this.reverse = !this.reverse;
					this.i = 0;
					this.init();
					this.active = true;
				}
			} else if (this.playmode == 3) {
				this.runtime.DestroyInstance(this.inst);
			} else if (this.playmode == 4) {
				this.loop = true;
				this.i = 0;
				this.init();
				this.active = true;
			} else if (this.playmode == 5) {
				if (isForceStop) {
					this.reverse = false;
					this.init();
				} else {
					if (this.pingpongCounter <= 0) {
						this.i = this.duration + this.initiating + this.cooldown;
						this.active = false;
					} else {
						if (!this.reverse) {
							this.pingpongCounter -= 1;
							this.reverse = true;
							this.i = 0;
							this.init();
							this.active = true;
						} else {
							this.pingpongCounter -= 1;
							this.reverse = false;
							this.i = 0;
							this.init();
							this.active = true;
						}
					}
				}
			} else if (this.playmode == -6) {
				this.playmode = this.lastPlayMode;
				this.reverse = false;
				this.i = 0;
				this.active = false;
			} else if (this.playmode == 6) {
				this.reverse = false;
				this.i = this.duration + this.initiating + this.cooldown;
				this.active = false;
			}
		}
		if (this.onCooldown == false) {
			this.onCooldown = true;
			this.runtime.trigger(cr.behaviors.lunarray_Tween.prototype.cnds.OnCooldownEnd, this.inst);
			this.onCooldownDone = true;
		}
	}
	behaviorProto.cnds = {};
	var cnds = behaviorProto.cnds;
	cnds.IsActive = function () {
		return this.active;
	};
	cnds.CompareGroupProgress = function (cmp, v) {
		var x = [];
		cr.lunarray_tweenGroup[this.group].forEach(function (value) {
			x.push((value.i / (value.duration + value.initiating + value.cooldown)));
		});
		return cr.do_cmp(Math.min.apply(null, x), cmp, v);
	}
	cnds.CompareProgress = function (cmp, v) {
		return cr.do_cmp((this.i / (this.duration + this.initiating + this.cooldown)), cmp, v);
	};
	cnds.OnStart = function () {
		if (this.onStartedDone === false) {
			return this.onStarted;
		}
	};
	cnds.OnWaitEnd = function () {
		if (this.onWaitEndDone === false) {
			return this.onWaitEnd;
		}
	};
	cnds.OnEnd = function (a, b, c) {
		if (this.onEndDone === false) {
			return this.onEnd;
		}
	};
	cnds.OnCooldownEnd = function () {
		if (this.onCooldownDone === false) {
			return this.onCooldown;
		}
	};
	behaviorProto.acts = {};
	var acts = behaviorProto.acts;
	acts.SetActive = function (a) {
		this.active = (a === 1);
	};
	acts.StartGroup = function (force, sgroup) {
		if (sgroup === "") sgroup = this.group;
		var groupReady = (force === 1) || cr.lunarray_tweenGroup[sgroup].every(function (value2) {
			return !value2.active;
		});
		if (groupReady) {
			cr.lunarray_tweenGroup[sgroup].forEach(
				function (value) {
					if (force === 1) {
						acts.Force.apply(value);
					} else {
						acts.Start.apply(value);
					}
				}
			);
		}
	}
	acts.StopGroup = function (stopmode, sgroup) {
		if (sgroup === "") sgroup = this.group;
		cr.lunarray_tweenGroup[sgroup].forEach(function (value) {
			acts.Stop.apply(value, [stopmode]);
		});
	}
	acts.ReverseGroup = function (force, rewindMode, sgroup) {
		if (sgroup === "") sgroup = this.group;
		var groupReady = (force === 1) || cr.lunarray_tweenGroup[sgroup].every(function (value2) {
			return !value2.active;
		});
		if (groupReady) {
			cr.lunarray_tweenGroup[sgroup].forEach(
				function (value) {
					if (force === 1) {
						acts.ForceReverse.apply(value, [rewindMode]);
					} else {
						acts.Reverse.apply(value, [rewindMode]);
					}
				}
			);
		}
	}
	acts.Force = function () {
		this.loop = (this.playmode === 4);
		if (this.playmode == 5) this.pingpongCounter = 1;
		if ((this.playmode == 6) || (this.playmode == -6)) {
			if (this.i < this.duration + this.cooldown + this.initiating) {
				this.reverse = false;
				this.init();
				this.active = true;
			}
		} else {
			this.reverse = false;
			this.i = 0;
			this.init();
			this.active = true;
		}
	};
	acts.ForceReverse = function (rewindMode) {
		this.rewindMode = (rewindMode == 1);
		this.loop = (this.playmode === 4);
		if (this.playmode == 5) this.pingpongCounter = 1;
		if ((this.playmode == 6) || (this.playmode == -6)) {
			if (this.i < this.duration + this.cooldown + this.initiating) {
				this.reverse = true;
				this.init();
				this.active = true;
			}
		} else {
			if (rewindMode) {
				if (this.pingpongCounter == 1) {
					if (this.i >= this.duration + this.cooldown + this.initiating) {
						this.reverse = true;
						this.i = 0;
						this.pingpongCounter = 2;
						this.init();
						this.active = true;
					}
				}
			} else {
				this.reverse = true;
				this.i = 0;
				this.init();
				this.active = true;
			}
		}
	};
	acts.Start = function () {
		if (!this.active) {
			this.loop = (this.playmode === 4);
			if (this.playmode == 5) this.pingpongCounter = 1;
			if ((this.playmode == 6) || (this.playmode == -6)) {
				if (this.i < this.duration + this.cooldown + this.initiating) {
					this.reverse = false;
					this.init();
					this.active = true;
				}
			} else {
				this.pingpongCounter = 1;
				this.reverse = false;
				this.i = 0;
				this.init();
				this.active = true;
			}
		}
	};
	acts.Stop = function (stopmode) {
		if (this.active) {
			if ((this.playmode == 2) || (this.playmode == 4)) {
				if (this.reverse) {
					this.i = 0;
				} else {
					this.i = -1;
				}
			} else {
				if (stopmode == 1) {
					this.saveState();
				} else if (stopmode == 0) {
					this.i = this.initiating + this.cooldown + this.duration;
				} else {
					this.i = 0;
				}
			}
			this.tick();
			this.active = false;
		}
	};
	acts.Pause = function () {
		if (this.active) {
			this.isPaused = true;
			this.active = false;
		}
	}
	acts.Resume = function () {
		if (this.isPaused) {
			this.active = true;
			this.isPaused = false;
		} else {
			if (!this.active) {
				this.reverse = false;
				this.i = 0;
				this.init();
				this.active = true;
			}
		}
	}
	acts.Reverse = function (rewindMode) {
		this.rewindMode = (rewindMode == 1);
		if (!this.active) {
			this.loop = (this.playmode === 4);
			if (this.playmode == 5) this.pingpongCounter = 1;
			if ((this.playmode == 6) || (this.playmode == -6)) {
				if (this.i < this.duration + this.cooldown + this.initiating) {
					this.reverse = true;
					this.init();
					this.active = true;
				}
			} else {
				if (rewindMode) {
					if (this.pingpongCounter == 1) {
						if (this.i >= this.duration + this.cooldown + this.initiating) {
							this.reverse = true;
							this.i = 0;
							this.pingpongCounter = 2;
							this.init();
							this.active = true;
						}
					}
				} else {
					this.reverse = true;
					this.i = 0;
					this.init();
					this.active = true;
				}
			}
		}
	};
	acts.SetDuration = function (x) {
		this.duration = x;
	};
	acts.SetWait = function (x) {
		this.wait = x;
		this.initiating = parseFloat(this.wait.split(",")[0]);
		this.cooldown = parseFloat(this.wait.split(",")[1]);
		if ((this.initiating < 0) || (isNaN(this.initiating))) this.initiating = 0;
		if ((this.cooldown < 0) || (isNaN(this.cooldown))) this.cooldown = 0;
	};
	acts.SetTarget = function (x) {
		if (typeof(x) == "string") {
			this.target = x;
			this.targetX = parseFloat(x.split(",")[0]);
			this.targetY = parseFloat(x.split(",")[1]);
		} else {
			this.target = x;
			this.targetX = x;
		}
		if (!this.active) {
			this.init();
		} else {
		}
	};
	acts.SetTargetObject = function (obj) {
		if (!obj)
			return;
		var otherinst = obj.getFirstPicked();
		if (!otherinst)
			return;
		this.targetObject = otherinst;
		this.target = "OBJ";
	};
	acts.SetTargetX = function (x) {
		if ((this.tweened == 2) || (this.tweened == 3) || (this.tweened == 4) || (this.tweened == 5) || (this.tweened == 6)) {
			if (typeof(x) == "string") {
				this.target = parseFloat(x.split(",")[0]);
			} else {
				this.target = "" + x + "," + this.targetY;
			}
			this.targetX = this.target;
		} else {
			var currY = this.target.split(",")[1];
			this.target = String(x) + "," + currY;
			this.targetX = parseFloat(this.target.split(",")[0]);
			this.targetY = parseFloat(this.target.split(",")[1]);
		}
		if (!this.active) {
			this.saveState();
			this.init();
		} else {
		}
	};
	acts.SetTargetY = function (x) {
		if ((this.tweened == 2) || (this.tweened == 3) || (this.tweened == 4) || (this.tweened == 5) || (this.tweened == 6)) {
			if (typeof(x) == "string") {
				this.target = parseFloat(x) + "";
			} else {
				this.target = this.targetX + "," + x;
			}
			this.targetX = this.target;
		} else {
			var currX = this.target.split(",")[0];
			this.target = currX + "," + String(x);
			this.targetX = parseFloat(this.target.split(",")[0]);
			this.targetY = parseFloat(this.target.split(",")[1]);
		}
		if (!this.active) {
			this.saveState();
			this.init();
		} else {
		}
	};
	acts.SetInitial = function (x) {
		if (typeof(x) == "string") {
			this.initial = x;
			this.initialX = parseFloat(x.split(",")[0]);
			this.initialY = parseFloat(x.split(",")[1]);
		} else {
			this.initial = "" + x;
			this.initialX = x;
		}
		if (this.tweened == 6) {
			this.value = this.initialX;
		}
		if (!this.active) {
			this.saveState();
			this.init();
		} else {
		}
	};
	acts.SetInitialX = function (x) {
		if ((this.tweened == 2) || (this.tweened == 3) || (this.tweened == 4) || (this.tweened == 5) || (this.tweened == 6)) {
			if (typeof(x) == "string") {
				this.initial = parseFloat(x);
			} else {
				this.initial = "" + x + "," + this.initialY;
			}
			this.initialX = this.initial;
		} else {
			if (this.initial == "") this.initial = "current";
			if (this.initial == "current") {
				var currY = this.tweenSaveY;
			} else {
				var currY = this.initial.split(",")[1];
			}
			this.initial = String(x) + "," + currY;
			this.initialX = parseFloat(this.initial.split(",")[0]);
			this.initialY = parseFloat(this.initial.split(",")[1]);
		}
		if (this.tweened == 6) {
			this.value = this.initialX;
		}
		if (!this.active) {
			this.saveState();
			this.init();
		} else {
		}
	};
	acts.SetInitialY = function (x) {
		if ((this.tweened == 2) || (this.tweened == 3) || (this.tweened == 4) || (this.tweened == 5) || (this.tweened == 6)) {
			if (typeof(x) == "string") {
				this.initial = parseFloat(x);
			} else {
				this.initial = "" + this.initialX + "," + x;
			}
			this.initialX = this.initial;
		} else {
			if (this.initial == "") this.initial = "current";
			if (this.initial == "current") {
				var currX = this.tweenSaveX;
			} else {
				var currX = this.initial.split(",")[0];
			}
			this.initial = currX + "," + String(x);
			this.initialX = parseFloat(this.initial.split(",")[0]);
			this.initialY = parseFloat(this.initial.split(",")[1]);
		}
		if (!this.active) {
			this.saveState();
			this.init();
		} else {
		}
	};
	acts.SetValue = function (x) {
		this.value = x;
	};
	acts.SetTweenedProperty = function (m) {
		this.tweened = m;
	};
	acts.SetEasing = function (w) {
		this.easing = w;
	};
	acts.SetPlayback = function (x) {
		this.playmode = x;
	};
	acts.SetParameter = function (tweened, playmode, easefunction, initial, target, duration, wait, cmode) {
		this.tweened = tweened;
		this.playmode = playmode;
		this.easing = easefunction;
		acts.SetInitial.apply(this, [initial]);
		acts.SetTarget.apply(this, [target]);
		acts.SetDuration.apply(this, [duration]);
		acts.SetWait.apply(this, [wait]);
		this.coord_mode = cmode;
		this.saveState();
	};
	behaviorProto.exps = {};
	var exps = behaviorProto.exps;
	exps.Progress = function (ret) {
		ret.set_float(this.i / (this.duration + this.initiating + this.cooldown));
	};
	exps.ProgressTime = function (ret) {
		ret.set_float(this.i);
	};
	exps.Duration = function (ret) {
		ret.set_float(this.duration);
	};
	exps.Initiating = function (ret) {
		ret.set_float(this.initiating);
	};
	exps.Cooldown = function (ret) {
		ret.set_float(this.cooldown);
	};
	exps.Target = function (ret) {
		ret.set_string(this.target);
	};
	exps.Value = function (ret) {
		ret.set_float(this.value);
	};
	exps.isPaused = function (ret) {
		ret.set_int(this.isPaused ? 1 : 0);
	};
}());

cr.behaviors.rex_Anchor2 = function(runtime)
{
	this.runtime = runtime;
};
(function () {
	var behaviorProto = cr.behaviors.rex_Anchor2.prototype;
	behaviorProto.Type = function (behavior, objtype) {
		this.behavior = behavior;
		this.objtype = objtype;
		this.runtime = behavior.runtime;
	};
	var behtypeProto = behaviorProto.Type.prototype;
	behtypeProto.onCreate = function () {
	};
	behaviorProto.Instance = function (type, inst) {
		this.type = type;
		this.behavior = type.behavior;
		this.inst = inst;				// associated object instance to modify
		this.runtime = type.runtime;
	};
	var behinstProto = behaviorProto.Instance.prototype;
	behinstProto.onCreate = function () {
		this.alignModeX = this.properties[0]; // 0=left, 1=right, 2=center, 3=hotspot, 4=none
		this.viewPortScaleX = this.properties[1]; // 0=window left, 0.5=window center, 1=window right
		this.alignModeY = this.properties[2]; // 0=top, 1=bottom, 2=center, 3=hotspot, 4=none
		this.viewPortScaleY = this.properties[3]; // 0=window top, 0.5=window center, 1=window bottom
		this.enabled = (this.properties[4] !== 0);
		this.set_once = (this.properties[5] == 1);
		this.update_cnt = 0;
		this.viewLeft_saved = null;
		this.viewRight_saved = null;
		this.viewTop_saved = null;
		this.viewBottom_saved = null;
	};
	behinstProto.is_layer_size_changed = function () {
		var layer = this.inst.layer;
		return (this.viewLeft_saved != layer.viewLeft) ||
			(this.viewRight_saved != layer.viewRight) ||
			(this.viewTop_saved != layer.viewTop) ||
			(this.viewBottom_saved != layer.viewBottom);
	};
	behinstProto.set_update_flag = function () {
		if (this.update_cnt === 0)
			this.update_cnt = 1;
	};
	behinstProto.tick = function () {
		if (!this.enabled)
			return;
		if (this.set_once) {
			if (this.is_layer_size_changed()) {
				var layer = this.inst.layer;
				this.viewLeft_saved = layer.viewLeft;
				this.viewRight_saved = layer.viewRight;
				this.viewTop_saved = layer.viewTop;
				this.viewBottom_saved = layer.viewBottom;
				this.update_cnt = 2;
			}
			if (this.update_cnt == 0)  // no need to update
				return;
			else                       // update once
				this.update_cnt -= 1;
		}
		var enableX = (this.alignModeX !== 4);
		var enableY = (this.alignModeY !== 4);
		if (!enableX && !enableY)
			return;
		var layer = this.inst.layer;
		var targetX = (enableX) ? layer.viewLeft + ( (layer.viewRight - layer.viewLeft) * this.viewPortScaleX ) : 0;
		var targetY = (enableY) ? layer.viewTop + ( (layer.viewBottom - layer.viewTop) * this.viewPortScaleY ) : 0;
		var inst = this.inst;
		var bbox = this.inst.bbox;
		inst.update_bbox();
		var nx = 0, ny = 0;
		switch (this.alignModeX) {
			case 0:    // set left edge to targetX
				nx = targetX + ( this.inst.x - bbox.left );
				break;
			case 1:    // set right edge to targetX
				nx = targetX + ( this.inst.x - bbox.right );
				break;
			case 2:    // cneter
				nx = targetX + ( this.inst.x - (bbox.right + bbox.left) / 2 );
				break;
			case 3:    // hotspot
				nx = targetX;
				break;
			case 4:    // None
				nx = this.inst.x;
				break;
		}
		switch (this.alignModeY) {
			case 0:    // top edge
				ny = targetY + ( this.inst.y - bbox.top );
				break;
			case 1:    // bottom edge
				ny = targetY + ( this.inst.y - bbox.bottom );
				break;
			case 2:    // cneter
				ny = targetY + ( this.inst.y - (bbox.bottom + bbox.top) / 2 );
				break;
			case 3:    // hotspot
				ny = targetY;
				break;
			case 4:    // None
				ny = this.inst.y;
				break;
		}
		if ((nx !== this.inst.x) || (ny !== this.inst.y)) {
			inst.x = nx;
			inst.y = ny;
			inst.set_bbox_changed();
		}
		if (this.set_once)
			this.runtime.trigger(cr.behaviors.rex_Anchor2.prototype.cnds.OnAnchored, this.inst);
	};
	behinstProto.saveToJSON = function () {
		return {
			"enabled": this.enabled,
			"amx": this.alignModeX,
			"vx": this.viewPortScaleX,
			"amy": this.alignModeY,
			"vy": this.viewPortScaleY,
		};
	};
	behinstProto.loadFromJSON = function (o) {
		this.enabled = o["enabled"];
		this.alignModeX = o["amx"];
		this.viewPortScaleX = o["vx"];
		this.alignModeY = o["amy"];
		this.viewPortScaleY = o["vy"];
	};

	function Cnds() {
	};
	behaviorProto.cnds = new Cnds();
	Cnds.prototype.OnAnchored = function () {
		return true;
	};

	function Acts() {
	};
	behaviorProto.acts = new Acts();
	Acts.prototype.SetEnabled = function (e) {
		var e = (e === 1);
		if (!this.enabled && e)
			this.set_update_flag();
		this.enabled = e;
	};
	Acts.prototype.SetHorizontalAlignMode = function (m) {
		if (m !== 4)
			this.set_update_flag();
		this.alignModeX = m;
	};
	Acts.prototype.SetHorizontalPosition = function (p) {
		this.set_update_flag();
		this.viewPortScaleX = p;
	};
	Acts.prototype.SetVerticalAlignMode = function (m) {
		if (m !== 4)
			this.set_update_flag();
		this.alignModeY = m;
	};
	Acts.prototype.SetVerticalPosition = function (p) {
		this.set_update_flag();
		this.viewPortScaleY = p;
	};

	function Exps() {
	};
	behaviorProto.exps = new Exps();
}());

cr.behaviors.scrollto = function(runtime)
{
	this.runtime = runtime;
	this.shakeMag = 0;
	this.shakeStart = 0;
	this.shakeEnd = 0;
	this.shakeMode = 0;
};
(function () {
	var behaviorProto = cr.behaviors.scrollto.prototype;
	behaviorProto.Type = function (behavior, objtype) {
		this.behavior = behavior;
		this.objtype = objtype;
		this.runtime = behavior.runtime;
	};
	var behtypeProto = behaviorProto.Type.prototype;
	behtypeProto.onCreate = function () {
	};
	behaviorProto.Instance = function (type, inst) {
		this.type = type;
		this.behavior = type.behavior;
		this.inst = inst;				// associated object instance to modify
		this.runtime = type.runtime;
	};
	var behinstProto = behaviorProto.Instance.prototype;
	behinstProto.onCreate = function () {
		this.enabled = (this.properties[0] !== 0);
	};
	behinstProto.saveToJSON = function () {
		return {
			"smg": this.behavior.shakeMag,
			"ss": this.behavior.shakeStart,
			"se": this.behavior.shakeEnd,
			"smd": this.behavior.shakeMode
		};
	};
	behinstProto.loadFromJSON = function (o) {
		this.behavior.shakeMag = o["smg"];
		this.behavior.shakeStart = o["ss"];
		this.behavior.shakeEnd = o["se"];
		this.behavior.shakeMode = o["smd"];
	};
	behinstProto.tick = function () {
	};

	function getScrollToBehavior(inst) {
		var i, len, binst;
		for (i = 0, len = inst.behavior_insts.length; i < len; ++i) {
			binst = inst.behavior_insts[i];
			if (binst.behavior instanceof cr.behaviors.scrollto)
				return binst;
		}
		return null;
	};
	behinstProto.tick2 = function () {
		if (!this.enabled)
			return;
		var all = this.behavior.my_instances.valuesRef();
		var sumx = 0, sumy = 0;
		var i, len, binst, count = 0;
		for (i = 0, len = all.length; i < len; i++) {
			binst = getScrollToBehavior(all[i]);
			if (!binst || !binst.enabled)
				continue;
			sumx += all[i].x;
			sumy += all[i].y;
			++count;
		}
		var layout = this.inst.layer.layout;
		var now = this.runtime.kahanTime.sum;
		var offx = 0, offy = 0;
		if (now >= this.behavior.shakeStart && now < this.behavior.shakeEnd) {
			var mag = this.behavior.shakeMag * Math.min(this.runtime.timescale, 1);
			if (this.behavior.shakeMode === 0)
				mag *= 1 - (now - this.behavior.shakeStart) / (this.behavior.shakeEnd - this.behavior.shakeStart);
			var a = Math.random() * Math.PI * 2;
			var d = Math.random() * mag;
			offx = Math.cos(a) * d;
			offy = Math.sin(a) * d;
		}
		layout.scrollToX(sumx / count + offx);
		layout.scrollToY(sumy / count + offy);
	};

	function Acts() {
	};
	Acts.prototype.Shake = function (mag, dur, mode) {
		this.behavior.shakeMag = mag;
		this.behavior.shakeStart = this.runtime.kahanTime.sum;
		this.behavior.shakeEnd = this.behavior.shakeStart + dur;
		this.behavior.shakeMode = mode;
	};
	Acts.prototype.SetEnabled = function (e) {
		this.enabled = (e !== 0);
	};
	behaviorProto.acts = new Acts();
}());
cr.getObjectRefTable = function () {
	return [
		cr.plugins_.AJAX,
		cr.plugins_.Arr,
		cr.plugins_.Audio,
		cr.plugins_.Dictionary,
		cr.plugins_.Browser,
		cr.plugins_.Function,
		cr.plugins_.Keyboard,
		cr.plugins_.LocalStorage,
		cr.plugins_.vooxe,
		cr.plugins_.MM_Preloader,
		cr.plugins_.Particles,
		cr.plugins_.Rex_Date,
		cr.plugins_.Rex_Hash,
		cr.plugins_.Touch,
		cr.plugins_.Sprite,
		cr.plugins_.Text,
		cr.plugins_.TiledBg,
		cr.plugins_.Rex_ZSorter,
		cr.plugins_.TextBox,
		cr.behaviors.lunarray_Tween,
		cr.behaviors.Pin,
		cr.behaviors.Fade,
		cr.behaviors.Sin,
		cr.behaviors.Timer,
		cr.behaviors.Rex_MoveTo,
		cr.behaviors.scrollto,
		cr.behaviors.LOS,
		cr.behaviors.Bullet,
		cr.behaviors.Rex_RotateTo,
		cr.behaviors.rex_Anchor2,
		cr.system_object.prototype.cnds.OnLayoutStart,
		cr.plugins_.Audio.prototype.cnds.IsTagPlaying,
		cr.system_object.prototype.acts.SetVar,
		cr.system_object.prototype.acts.SetLayerVisible,
		cr.plugins_.Function.prototype.acts.CallFunction,
		cr.system_object.prototype.cnds.CompareVar,
		cr.system_object.prototype.cnds.For,
		cr.system_object.prototype.exps.loopindex,
		cr.system_object.prototype.cnds.Every,
		cr.system_object.prototype.cnds.Compare,
		cr.plugins_.Arr.prototype.exps.Width,
		cr.system_object.prototype.acts.AddVar,
		cr.system_object.prototype.cnds.EveryTick,
		cr.plugins_.Rex_ZSorter.prototype.acts.SortObjsLayerByY,
		cr.plugins_.Sprite.prototype.exps.Angle,
		cr.system_object.prototype.acts.SetLayerScale,
		cr.system_object.prototype.acts.SetLayerAngle,
		cr.system_object.prototype.cnds.PickOverlappingPoint,
		cr.plugins_.Sprite.prototype.exps.X,
		cr.plugins_.Sprite.prototype.exps.Y,
		cr.system_object.prototype.exps["int"],
		cr.system_object.prototype.cnds.PickAll,
		cr.system_object.prototype.cnds.PickByComparison,
		cr.system_object.prototype.cnds.TriggerOnce,
		cr.system_object.prototype.acts.CreateObject,
		cr.plugins_.Sprite.prototype.acts.SetAnimFrame,
		cr.behaviors.Rex_RotateTo.prototype.acts.SetTargetAngle,
		cr.system_object.prototype.acts.SetGroupActive,
		cr.plugins_.Sprite.prototype.cnds.CompareY,
		cr.plugins_.Sprite.prototype.acts.Destroy,
		cr.plugins_.Function.prototype.cnds.OnFunction,
		cr.plugins_.Function.prototype.cnds.CompareParam,
		cr.plugins_.Arr.prototype.exps.At,
		cr.plugins_.Sprite.prototype.acts.SetSize,
		cr.plugins_.Sprite.prototype.acts.SetVisible,
		cr.plugins_.Audio.prototype.acts.PlayByName,
		cr.system_object.prototype.acts.Wait,
		cr.behaviors.Pin.prototype.acts.Pin,
		cr.system_object.prototype.cnds.Else,
		cr.plugins_.Function.prototype.exps.Param,
		cr.plugins_.Sprite.prototype.acts.SetInstanceVar,
		cr.plugins_.Sprite.prototype.acts.SetScale,
		cr.system_object.prototype.exps.random,
		cr.system_object.prototype.cnds.CompareBetween,
		cr.system_object.prototype.exps.choose,
		cr.plugins_.Sprite.prototype.acts.SetAnim,
		cr.behaviors.lunarray_Tween.prototype.acts.SetParameter,
		cr.behaviors.Sin.prototype.acts.SetMagnitude,
		cr.behaviors.Sin.prototype.acts.SetPhase,
		cr.behaviors.Sin.prototype.acts.SetMovement,
		cr.plugins_.Sprite.prototype.acts.SetEffect,
		cr.plugins_.Sprite.prototype.acts.SetOpacity,
		cr.behaviors.Fade.prototype.acts.SetWaitTime,
		cr.behaviors.Fade.prototype.acts.SetFadeOutTime,
		cr.behaviors.Sin.prototype.acts.SetActive,
		cr.plugins_.Sprite.prototype.acts.MoveToBottom,
		cr.plugins_.Audio.prototype.exps.CurrentTime,
		cr.system_object.prototype.exps.layoutwidth,
		cr.system_object.prototype.exps.layoutheight,
		cr.plugins_.Text.prototype.acts.SetText,
		cr.system_object.prototype.exps.cpuutilisation,
		cr.system_object.prototype.exps.fps,
		cr.plugins_.Audio.prototype.exps.Duration,
		cr.system_object.prototype.cnds.IsMobile,
		cr.plugins_.TiledBg.prototype.acts.SetSize,
		cr.plugins_.Browser.prototype.exps.ScreenWidth,
		cr.plugins_.Browser.prototype.exps.ScreenHeight,
		cr.plugins_.Keyboard.prototype.cnds.OnKey,
		cr.plugins_.Arr.prototype.acts.JSONDownload,
		cr.plugins_.Arr.prototype.acts.Push,
		cr.plugins_.Arr.prototype.acts.SetXY,
		cr.plugins_.Touch.prototype.cnds.OnTouchStart,
		cr.system_object.prototype.cnds.IsGroupActive,
		cr.plugins_.Touch.prototype.cnds.OnTapGesture,
		cr.behaviors.Rex_MoveTo.prototype.acts.SetTargetPosByDeltaXY,
		cr.behaviors.Rex_MoveTo.prototype.acts.SetMaxSpeed,
		cr.behaviors.Rex_MoveTo.prototype.cnds.OnHitTarget,
		cr.plugins_.Audio.prototype.acts.SetPaused,
		cr.behaviors.Bullet.prototype.acts.SetEnabled,
		cr.behaviors.Bullet.prototype.acts.SetAngleOfMotion,
		cr.behaviors.Bullet.prototype.acts.SetSpeed,
		cr.behaviors.scrollto.prototype.acts.Shake,
		cr.plugins_.Sprite.prototype.cnds.IsOverlapping,
		cr.plugins_.Sprite.prototype.cnds.IsOverlappingOffset,
		cr.behaviors.LOS.prototype.cnds.HasLOSToObject,
		cr.plugins_.Sprite.prototype.cnds.CompareInstanceVar,
		cr.plugins_.Sprite.prototype.cnds.IsBoolInstanceVarSet,
		cr.plugins_.Sprite.prototype.exps.AnimationFrame,
		cr.plugins_.Sprite.prototype.acts.AddInstanceVar,
		cr.plugins_.Sprite.prototype.acts.SetBoolInstanceVar,
		cr.behaviors.Timer.prototype.acts.StartTimer,
		cr.behaviors.lunarray_Tween.prototype.acts.Start,
		cr.behaviors.Fade.prototype.acts.StartFade,
		cr.behaviors.Timer.prototype.cnds.OnTimer,
		cr.plugins_.Sprite.prototype.cnds.OnCollision,
		cr.plugins_.Sprite.prototype.acts.MoveToLayer,
		cr.plugins_.Sprite.prototype.acts.Spawn,
		cr.plugins_.Audio.prototype.acts.Play,
		cr.plugins_.Sprite.prototype.cnds.IsAnimPlaying,
		cr.plugins_.Text.prototype.cnds.CompareInstanceVar,
		cr.plugins_.Text.prototype.acts.SetVisible,
		cr.plugins_.Touch.prototype.cnds.OnTouchObject,
		cr.system_object.prototype.cnds.LayerVisible,
		cr.plugins_.Sprite.prototype.cnds.IsVisible,
		cr.plugins_.Text.prototype.acts.SetFontSize,
		cr.system_object.prototype.acts.RestartLayout,
		cr.plugins_.AJAX.prototype.acts.RequestFile,
		cr.plugins_.AJAX.prototype.cnds.OnComplete,
		cr.plugins_.Arr.prototype.acts.JSONLoad,
		cr.plugins_.AJAX.prototype.exps.LastData,
		cr.plugins_.Arr.prototype.acts.Reverse,
		cr.system_object.prototype.acts.GoToLayout,
		cr.system_object.prototype.exps.originalwindowheight,
		cr.system_object.prototype.exps.originalwindowwidth,
		cr.plugins_.MM_Preloader.prototype.acts.AddFromLayoutByName,
		cr.plugins_.MM_Preloader.prototype.acts.AddC2EngineProgress,
		cr.plugins_.MM_Preloader.prototype.acts.StabilizerSetState,
		cr.plugins_.MM_Preloader.prototype.acts.Start,
		cr.plugins_.Audio.prototype.acts.PreloadByName,
		cr.plugins_.Audio.prototype.cnds.PreloadsComplete,
		cr.plugins_.MM_Preloader.prototype.acts.SetItemState,
		cr.plugins_.MM_Preloader.prototype.cnds.OnProgress,
		cr.plugins_.MM_Preloader.prototype.exps.Progress,
		cr.system_object.prototype.exps.floor,
		cr.behaviors.Rex_MoveTo.prototype.acts.SetTargetPosOnObject,
		cr.plugins_.MM_Preloader.prototype.cnds.OnCompleted,
		cr.system_object.prototype.acts.GoToLayoutByName,
		cr.plugins_.Browser.prototype.cnds.OnResize,
		cr.system_object.prototype.exps.tokenat,
		cr.plugins_.Browser.prototype.exps.Domain,
		cr.plugins_.Browser.prototype.exps.URL,
		cr.plugins_.Rex_Date.prototype.exps.UnixTimestamp,
		cr.plugins_.Rex_Date.prototype.exps.Date2UnixTimestamp,
		cr.system_object.prototype.exps.viewportright,
		cr.system_object.prototype.exps.viewportleft,
		cr.system_object.prototype.exps.viewportbottom,
		cr.system_object.prototype.exps.viewporttop,
		cr.plugins_.Browser.prototype.acts.ExecJs
	]
}