(function(window){
	const 
		FRAMERATE = 30,
		DURATION = 2000,
		COUNT_FRAMERATE = 20,
		FRAMES_PER_VALUE = 2,
		SPEEDBOOST = 0.5,
		MS_PER_FRAME = 1000 / FRAMERATE;
	
	let createFromHTML = html => {
		let root = document.implementation.createHTMLDocument().body;
		root.innerHTML = html;
		let children = [];
		Array.from(root.children).forEach(child => children.push(child));
		if (children.length === 1) return children[0];
		return children;
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
			
		}
	}
})(this === window ? this : window);
