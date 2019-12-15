(function(window){
	const 
		FRAMERATE = 30,
		DURATION = 2000,
		COUNT_FRAMERATE = 20,
		FRAMES_PER_VALUE = 2,
		SPEEDBOOST = 0.5,
		MS_PER_FRAME = 1000 / FRAMERATE,
		DIGIT_FORMAT = "(,ddd).dd",
		FORMAT_PARSER = /^\(?([^)]*)\)?(?:(.)(d+))?$/,
		COUNT_MS_PER_FRAME = 1000 / COUNT_FRAMERATE,
		
		VALUE_HTML = '<span class="odometer-value"></span>',
		RIBBON_HTML = '<div class="odometer-ribbon"><div class="odometer-ribbon__inner">' + VALUE_HTML + '</div></div>',
		DIGIT_HTML = '<section class="odometer-digit"><span class="odometer-digit__spacer"></span><div class="odometer-digit__inner">' + RIBBON_HTML + '</div></section>',
		FORMAT_MARK_HTML = '<div class="odometer-formatting-mark"></div>';
	
	let createFromHTML = (html, idx) => {
		let root = document.implementation.createHTMLDocument().body;
		root.innerHTML = html;
		let children = [];
		Array.from(root.children).forEach(child => children.push(child));
		if (children.length === 1) return children[0];
		if (typeof idx !== "number") idx = false;
		else if (isNaN(idx) || !isFinite(idx)) idx = false;

		if (!idx) return children;
		return children[idx];
	};
	
	let round = (n, precision) => {
		if (precision === null) precision = 0;
		if (!precision) return Math.round(n);
		
		let p = Math.pow(10, precision);
		n *= p; n += 0.5; n = Math.floor(n);
		return n /= p;
	};
	
	let trunc = n => n < 0 ? Math.ceil(n) : Math.floor(n);
	
	let fpart = n => n - round(n);
	
	let setImmediate = (fn, ctx) => {
		if (typeof fn !== "function") return;
		if (ctx === void 0) ctx = window;
		return setTimeout(fn.bind(ctx), 0);
	};
	
	class Odometer {
		constructor(options){
			this.options = Object.assign({}, options);
			this.el = this.options.el;
			if (this.el.odometer !== null) return this.el.odometer;
			this.el.odometer = this;

			let ref = Odometer.options;
			for (let k in ref){
				let v = ref[k];
				if (this.options[k] === null) this.options[k] = v;
			}

			let base;
			if ((base = this.options).duration === null) base.duration = DURATION;

			this.MAX_VALUES = ((this.options.duration / MS_PER_FRAME) / FRAMES_PER_VALUE) | 0;
			this.resetFormat();

			let value;
			this.value = this.sanitize((value = this.options.value) !== null ? value : "");
			this.renderInside();
			this.render();
			try {
				let content = ["innerHTML", "innerText", "textContent"];
				for (let i = 0, len = content.length; i < len; i++){
					let prop = content[i];
					if (this.el[prop] !== null){
						(() => Object.defineProperty(this.el, prop, {
							get: () => {
								let text;
								if (prop === "innerHTML") return this.inside.outerHTML;
								else return (text = this.inside.innerText) !== null ? text : this.inside.textContent;
							},
							set: val => this.update(val)
						}))();
					}
				}
			} catch (ignore){}
			return this;
		}

		renderInside(){
			this.inside = document.createElement("div");
			this.inside.className = "OdometerComponent odometer-inner";
			this.el.innerHTML = "";
			return this.el.appendChild(this.inside);
		}

		sanitize(value){
			let ref;
			if (typeof value === "string"){
				value = value.replace((ref = this.format.radix) !== null ? ref : ".", "<radix>");
				value = value.replace(/[.,]/g, "");
				value = value.replace("<radix>", ".");
				value = parseFloat(value, 10) || 0;
			}

			return round(value, this.format.precision);
		}

		bindTransitionEnd(){
			if (this.transitionEndBound)return;
			this.transitionEndBound = true;

			let renderEnqueued = false;
			let ref = "transitionend";
			let res = [];

			res.push(this.el.addEventListener(ref, () => {
				if (renderEnqueued) return true;
				renderEnqueued = true;
				setImmediate(() => {
					this.render();
					renderEnqueued = false;
				});
				return true;
			}, false));

			return res;
		}

		resetFormat(){
			let ref,
				format = (ref = this.options.format) !== null ? ref : DIGIT_FORMAT;
			
			format || (format = "d")
			let parsed = FORMAT_PARSER.exec(format);
			if (!parsed) throw new ReferenceError("The digit format is unparsable. Aborting now!");

			let a = parsed.slice(1, 4),
				repeating = a[0], radix = a[1], fractional = a[2];
			
			let precision = (fractional !== null ? fractional.length : void 0) || 0;
			return this.format = {
				repeating: repeating,
				radix: radix,
				precision: precision
			};
		}

		render(value){
			if (value === null || value === void 0) value = this.value;
			this.resetFormat();
			this.inside.innerHTML = "";
			let theme = this.options.theme;
			let classes = this.el.className.split(" ");
			let newClasses = [], cls, match;

			for (let i = 0, len = classes.length; i < len; i++){
				cls = classes[i];
				if (!cls.length) continue;

				if ((match = /^odometer-theme-(.+)$/.exec(cls))){
					theme = match[1];
					continue;
				}

				if (/^odometer(-|$)/.test(cls)) continue;

				newClasses.push(cls);
			}

			newClasses.push("odometer");
			
			if (theme){
				newClasses.push("odometer-no-transitions");
			} else {
				newClasses.push("odometer-auto-theme");
			}

			this.el.className = newClasses.join(" ");
			this.ribbons = {};
			this.formatDigits(value);
			return this;
		}

		formatDigits(value){
			this.digits = [];
			if (typeof this.options.formatFunction === "function"){
				let valueString = this.options.formatFunction.call(this, value);
				let ref = valueString.split("").reverse();
				for (let i = 0, len = ref.length; i < len; i++){
					let valueDigit = ref[i];

					if (valueDigit.match(/\d/)){
						let digit = this.renderDigit();
						digit.querySelector(".odometer-value").innerHTML = valueDigit;
						this.digits.push(digit);
						this.insertDigit(digit);
					} else {
						this.addSpacer(valueDigit);
					}
				}
			} else {
				let wholePart = !this.format.precision || !fpart(value) || false;
				let ref1 = value.toString().split("").reverse();

				for (let j = 0, l = ref1.length; j < l; j++){
					let digit = ref1[j];
					if (digit === ".") wholePart = true;
					this.addDigit(digit, wholePart);
				}
			}
		}

		update(value){
			value = this.sanitize(value);
			let diff;
			if (!(diff = value - this.value)) return;

			this.el.classList.remove('odometer-animating-up odometer-animating-down odometer-animating');
			if (diff > 0) this.el.classList.add("odometer-animating-up");
			else this.el.classList.remove("odometer-animating-down");

			this.animate(value);
			setImmediate(() => {
				this.el.offsetHeight;
				return this.el.classList.add("odometer-animating");
			});

			return this.value = value;
		}

		renderDigit(){
			return createFromHTML(DIGIT_HTML, 0);
		}

		insertDigit(digit, before){
			if (before !== null){
				return this.inside.insertBefore(digit, before);
			} else if (!this.inside.children.length){
				return this.inside.appendChild(digit);
			} else {
				return this.inside.insertBefore(digit, this.inside.children[0]);
			}
		}

		addSpacer(character, before, classes){
			let spacer = createFromHTML(FORMAT_MARK_HTML, 0);
			spacer.innerHTML = character;
			if (classes) spacer.classList.add(classes);

			return this.insertDigit(spacer, before);
		}

		addDigit(value, repeating){
			let ref, digit;
			if (repeating === null || repeating === void 0) repeating = true;

			if (value === "-") return this.addSpacer(value, null, "odometer-negation__mark");
			if (value === ".") return this.addSpacer((ref = this.format.radix) !== null ? ref : ".", null, "odometer-radix__mark");

			if (repeating){
				let resetted = false;
				while (true){
					if (!this.format.repeating.length){
						if (resetted) throw new ReferenceError("Bad odometer format without digits.");
						this.resetFormat();
						resetted = true;
					}

					let character = this.format.repeating[this.format.repeating.length - 1];
					this.format.repeating = this.format.repeating.substring(0, this.format.repeating.length - 1);

					if (character === "d") break;
					this.addSpacer(character);
				}
			}

			digit = this.renderDigit();
			digit.querySelector(".odometer-value").innerHTML = value;
			this.digits.push(digit);
			return this.insertDigit(digit);
		}

		animate(value){
			if (this.options.animate === "count") return this.animateCount(value);
			return this.animateSlide(value);
		}

		animateCount(value){
			let diff;

			if (!(diff = +value - this.value)) return;
			let start, last;

			start = last = Date.now();
			let curr = this.value;

			return (tick = () => {
				let delta, dist, frac;

				if ((Date.now() - start) > this.options.duration){
					this.value = value;
					this.render();
					return;
				}

				delta = Date.now() - last;
				if (delta > COUNT_MS_PER_FRAME){
					last = Date.now();
					frac = delta / this.options.duration;
					dist = diff * frac;
					curr += dist;

					this.render(Math.round(curr));
				}

				return requestAnimationFrame(tick);
			})();
		}

		getDigitCount(){
			let values = 1 <= arguments.length ? Array.from(arguments) : [];
			for (let i = 0, j = 0, len = values.length; i < len; i = ++j){
				let value = values[i];
				values[i] = Math.abs(value);
			}
			let max = Math.max.apply(null, value);
			return Math.ceil(Math.log(max + 1) / Math.log(10));
		}

		getFractionalDigitCount(){
			let values = 1 <= arguments.length ? Array.from(arguments) : [];
			let parser = /^\-?\d*\.(\d*?)0*$/;
			for (let i = 0, j = 0, len = values.length; i < len; i = ++j){
				let value = values[i];
				values[i] = value.toString();
				let parts = parser.exec(values[i]);

				if (parts === null) values[i] = 0;
				else values[i] = parts[1].length;
			}
			return Math.max.apply(null, values);
		}

		resetDigits(){
			this.digits = [];
			this.ribbons = [];
			this.inside.innerHTML = "";
			return this.resetFormat();
		}

		animateSlide(value){
			let oldValue = this.value;
			let fractionalCount = this.getFractionalDigitCount(oldValue, value);

			if (fractionalCount){
				value = value * Math.pow(10, fractionalCount);
				oldValue = oldValue * Math.pow(10, fractionalCount);
			}

			let diff;
			if (!(diff = value - oldValue)) return;
			this.bindTransitionEnd();

			let digitCount = this.getDigitCount(oldValue, value);
			let digits = [];
			let boosted = 0;

			for (let i = 0, j = 0; 0 <= digitCount ? j < digitCount : j > digitCount; i = 0 <= digitCount ? ++j : --j){
				let start = trunc(oldValue / Math.pow(10, digitCount - i - 1));
				let end = trunc(value / Math.pow(10, digitCount - i - 1));
				let dist = end - start;
				let frames = [];

				if (Math.abs(dist) > this.MAX_VALUES){
					frames = [];
					let increment = dist / (this.MAX_VALUES + this.MAX_VALUES * boosted * SPEEDBOOST);
					let curr = start;
					while ((dist > 0 && curr < end) || (dist < 0 && curr > end)){
						frames.push(Math.round(curr));
						curr += increment;
					}

					if (frames[frames.length - 1] !== end) frames.push(end);
					boosted++;
				} else {
					frames = (() => {
						let results = [];
						for (let k = start; start <= end ? k <= end : k >= end; start <= end ? k++ : k--) results.push(k);
						return results;
					})();
				}

				let l, len;
				for (i = l = 0, len = frames.length; l < len; i = ++l){
					let frame = frames[i];
					frames[i] = Math.abs(frame % 10);
				}

				digits.push(frames);
			}
			this.resetDigits();
			let ref = digits.reverse();
			let n;
			for (let m = n = 0, len1 = ref.length; n < len1; m = ++n){
				let frames = ref[m];
				if (!this.digits[m]){
					this.addDigit(" ", m >= fractionalCount);
				}

				let base;
				if ((base = this.ribbons)[m] == null){
					base[m] = this.digits[m].querySelector("odometer-ribbon__inner");
				}

				this.ribbons[m].innerHTML = "";
				if (diff < 0) frames = frames.reverse();

				let p;
				for (let o = p = 0, len2 = frames.length; p <= len2; o = ++p){
					let frame = frames[o];
					let numEl = document.createElement("div");
					numEl.className = "odometer-value";
					numEl.innerHTML = frame;

					this.ribbons[m].appendChild(numEl);
					if (o === frames.length - 1){
						numEl.classList.add("odometer-last__value");
					}

					if (o === 0){
						numEl.classList.add("odometer-first__value");
					}
				}
			}

			if (start < 0) this.addDigit("-");
			let mark = this.inside.querySelector(".odometer-radix__mark");
			if (mark !== null){
				mark.parentElement.removeChild(mark);
			}

			if (fractionalCount){
				return this.addSpacer(this.format.radix, this.digits[fractionalCount - 1], "odometer-radix__mark");
			}
		}

		static options = Object.assign({}, window.odometerOptions);

		static init(){
			if (document.querySelectorAll == null) return;

			let elements = document.querySelectorAll(Odometer.options.selector || ".odometer");
			let results = [];

			for (let i = 0, len = elements.length; i < len; i++){
				let element = elements[i], ref;
				results.push(element.odometer = new Odometer({
					el: element,
					value: (ref = element.innerText) !== null ? ref : element.textContent
				}));
			}

			return results;
		}
	}

	setImmediate(() => {
		if (window.odometerOptions){
			let ref = window.odometerOptions;
			let results = [];
			let base;

			for (let k in ref){
				let v = ref[k];
				results.push((base = Odometer.options)[k] !== null ? (base = Odometer.options)[k] : base[k] = v);
			}

			return results;
		}
	});

	window.Odometer = Odometer;
})(this === window ? this : window);
