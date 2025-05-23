(function( $, app, i18n ) {

	var ui = app.ns("ui");

	ui.IndexSelector = ui.AbstractWidget.extend({
		init: function(parent) {
			this._super();
			this.el = $(this._main_template());
			this.attach( parent );
			this.cluster = this.config.cluster;
			this.allOptions = []; // 存储所有选项，以便过滤
			this.update();
		},
		update: function() {
			this.cluster.get( "_stats", this._update_handler );
		},
		
		_update_handler: function(data) {
			var options = [];
			var index_names = Object.keys(data.indices).sort();
			for(var i=0; i < index_names.length; i++) { 
				name = index_names[i];
				options.push(this._option_template(name, data.indices[name])); 
			}
			this.allOptions = options; // 保存所有选项
			this.el.find(".uiIndexSelector-select").empty().append(this._select_template(options));
			this._indexChanged_handler();
		},
		
		_main_template: function() {
			return { tag: "DIV", cls: "uiIndexSelector", children: [
				{ tag: "INPUT", cls: "uiIndexSelector-filter", placeholder: i18n.text("Overview.IndexFilter"), onKeyup: this._filterChanged_handler },
				i18n.complex( "IndexSelector.SearchIndexForDocs", { tag: "SPAN", cls: "uiIndexSelector-select" } )
			]};
		},

		_indexChanged_handler: function() {
			this.fire("indexChanged", this.el.find("SELECT").val());
		},

		_filterChanged_handler: function(jEv) {
			var filter = $(jEv.target).val().toLowerCase();
			var filteredOptions = filter ? 
				this.allOptions.filter(function(option) {
					return option.value.toLowerCase().indexOf(filter) !== -1;
				}) : 
				this.allOptions;
			
			this.el.find(".uiIndexSelector-select").empty().append(this._select_template(filteredOptions));
		},

		_select_template: function(options) {
			return { tag: "SELECT", children: options, onChange: this._indexChanged_handler };
		},
		
		_option_template: function(name, index) {
			return  { tag: "OPTION", value: name, text: i18n.text("IndexSelector.NameWithDocs", name, index.primaries.docs.count ) };
		}
	});

})( this.jQuery, this.app, this.i18n );
