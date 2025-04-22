// 确保i18n对象在测试运行前被正确初始化
(function() {
  if (typeof i18n === 'undefined') {
    window.i18n = {
      keys: {},
      setKeys: function(keys) {
        for (var key in keys) {
          if (keys.hasOwnProperty(key)) {
            this.keys[key] = keys[key];
          }
        }
      },
      setLocale: function(locale) {
        this.locale = locale;
      },
      text: function(key) {
        if (!this.keys) return key;
        var args = Array.prototype.slice.call(arguments);
        var text = this.keys[args.shift()] || key;
        if (args.length === 0) {
          return text;
        }
        return text.replace(/\{(\d+)\}/g, function(match, index) {
          return args[index];
        });
      },
      complex: function() {
        var args = Array.prototype.slice.call(arguments),
            key = this.keys ? this.keys[args.shift()] : args.shift(),
            ret = [],
            replacer = function(x, pt, sub) { ret.push(pt || args[+sub]); return ""; };
        do {} while(key && key !== (key = key.replace(/([^{]+)|\{(\d+)\}/, replacer)));
        return ret;
      }
    };
  }
})(); 