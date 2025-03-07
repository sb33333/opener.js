/**
 * Layer Popup Utility Module
 * 
 * This module provides functionality to open and manage layer popups dynamically. 
 * It includes utilities to track popup visibility, observe changes, and handle focus conditions.
 * 
 * Features:
 * - Open a popup with a target ID and URL.
 * - Monitor popup closing using MutationObserver.
 * - Wait for the popup to be ready before resolving.
 * - Provide a mixin system for extending popup behaviors.
 */
(function() {
	// Prevent multiple initializations
	if (globalThis[Symbol.for("OPENER_UTIL")]) return;
	
	var map = new Map(); // Stores popup contexts
	var DEFAULT_TIMEOUT = 5000; // Default timeout for waiting conditions
	
	// Default predicate function to check if a popup is focusable
	var DEFAULT_PREDICATE_FUNCTION = function (id) {
		return function () {
			var element = document.getElementById(id);
			return (element) && Array.from(element.querySelectorAll("*")).filter(isFocusable).length > 0;
		}
	}
	
	// MutationObserver options for monitoring popup visibility changes
	var CLOSING_OBSERVER_OPTIONS = { attributes: true, attributeFilter: ["style"] };
	
	/**
	 * Creates a layer popup opener object.
	 * 
	 * @param {string} targetId - The ID of the target popup container.
	 * @param {string} url - The URL to load inside the popup.
	 * @returns {Object} A layer popup opener instance.
	 * 
	 * Features:
	 * - Manages popup lifecycle.
	 * - Waits for the popup to become interactive.
	 * - Observes the popup's visibility changes.
	 * - Supports custom onload and onclose handlers.
	 * - Supports parent context for shared state management.
	 * 
	 * Handlers:
	 * - onloadHandler: Function that is executed when the popup is successfully loaded and becomes visible.
	 * - oncloseHandler: Function that is executed when the popup is closed or hidden.
	 * 
	 * Context Management:
	 * - `parentContext` can be passed to create a new context.
	 * - The created context can be accessed using `getContext(targetId)`.
	 */
	var layerPopupOpener = function (targetId, url) {
		if (!targetId || !url) throw new Error("targetId, url cannot be empty");
		
		return {
			_targetId: targetId,
			_url: url,
			_data: undefined,
			_callback: undefined,
			_p: undefined,
			_t: undefined,
			_oncloseHandler: undefined,
			_onloadHandler: undefined,
			_parentContext: undefined,
			_predicate: undefined,
			
			get targetId() { return this._targetId; },
			get url() { return this._url; },
			get data() { return this._data; },
			set data(data) { this._data = data; },
			get callback() { return this._callback },
			set callback(callback) { this._callback = callback; },
			get p() { return this._p; },
			set p(p) { this._p = p; },
			get t() { return this._t; },
			set t(t) { this._t = t; },
			set onclose(handler) { this._oncloseHandler = handler; },
			set onload(handler) { this._onloadHandler = handler; },
			set parentContext(parentContext) { this._parentContext = parentContext },
			set predicate(predicateFunction) { this._predicate = predicateFunction; },
			
			load() {
				// TODO opening the popup
				mock(this._targetId, this._url, this._data, this._callbackFunc, this._p, this._t);
				
				// Store popup context
				map.set(this._targetId, createWithMixin(this._parentContext || {}));
				
				// Define condition to wait for popup readiness
				var f = this._predicate || DEFAULT_PREDICATE_FUNCTION(this._targetId);
				var openPromise = waitForCondition(DEFAULT_TIMEOUT, f)
				.then(() => {
					var targetElement = document.getElementById(this._targetId);
					var observer = new MutationObserver(observeCallback(this._oncloseHandler));
					observer.observe(targetElement, CLOSING_OBSERVER_OPTIONS);
				})
				.then(() => {
					var targetElement = document.getElementById(this._targetId);
					this._onloadHandler && this._onloadHandler(targetElement);
					return targetElement;
				});
				
				return openPromise;
			},
		}
	}
	
	// Mixin utility to extend objects
	var extendable = {
		extend: function (...source) {
			return Object.assign(this, ...source);
		}
	}
	
	// Creates an object with the ability to extend itself
	var createWithMixin = function (parent) {
		var temp = Object.assign({}, extendable);
		Object.setPrototypeOf(temp, parent);
		return Object.create(temp);
	}
	
	// Waits for a condition to be met within a timeout period
	var waitForCondition = function (timeoutLimit, predicateFunction) {
		var start = window.performance.now();
		return new Promise((res, rej) => {
			(function recursiveCall() {
				if ((window.performance.now() - start) > timeoutLimit) rej(new Error("timeout"));
				if (predicateFunction()) {
					console.debug("resolve");
					res("resolve");
					return;
				}
				requestAnimationFrame(recursiveCall);
			})();
		});
	}
	
	// Observes popup visibility changes and triggers onclose callback
	function observeCallback(onclose) {
		var disconnected = false;
		return (mutations, observer) => {
			if (disconnected) return;
			mutations.forEach(mutation => {
				var display = window.getComputedStyle(mutation.target).display;
				if (!disconnected && display === "none") {
					console.debug("disconnected:::", observer);
					disconnected = true;
					observer.disconnect();
					if (typeof onclose === "function") onclose();
				}
			})
		}
	}
	
	// Determines whether an element is focusable
	function isFocusable(element) {
		if (!element) return false;
		var style = window.getComputedStyle(element);
		if (style.display === "none" || style.visibility === "hidden") return false;
		if (element.disabled) return false;
		if (element.hidden) return false;
		if (element.tabIndex < 0) return false;
		
		var focusableTags = ["A", "BUTTON", "INPUT", "TEXTAREA", "SELECT", "DETAILS"];
		if (focusableTags.includes(element.tagName)) return true;
		
		return element.tabIndex >= 0;
	}
	
	// Module exports
	var mod = {
		opener: layerPopupOpener,
		getContext: (id) => map.get(id),
	}
	
	// Register as a global utility
	globalThis[Symbol.for("OPENER_UTIL")] = mod;
})();

function mock () {};
