(function( $, app, i18n ) {

	var ui = app.ns("ui");
	var data = app.ns("data");
	var ut = app.ns("ut");

	ui.FilterBrowser = ui.AbstractWidget.extend({
		defaults: {
			cluster: null,  // (required) instanceof app.services.Cluster
			index: "" // (required) name of the index to query
		},

		init: function(parent) {
			this._super();
			this._cluster = this.config.cluster;
			this.el = $(this._main_template());
			this.filtersEl = this.el.find(".uiFilterBrowser-filters");
			this.attach( parent );
			new data.MetaDataFactory({ cluster: this._cluster, onReady: function(metadata, eventData) {
				this.metadata = metadata;
				this._createFilters_handler(eventData.originalData.metadata.indices);
			}.bind(this) });
		},

		_createFilters_handler: function(data) {
			var filters = [];
			function scan_properties(path, obj) {
				if (obj.properties) {
					for (var prop in obj.properties) {
						scan_properties(path.concat(prop), obj.properties[prop]);
					}
				} else {
					// handle multi_field 
					if (obj.fields) {
						for (var subField in obj.fields) {
							filters.push({ path: (path[path.length - 1] !== subField) ? path.concat(subField) : path, type: obj.fields[subField].type, meta: obj.fields[subField] });
						}
					}
					filters.push({ path: path, type: obj.type, meta: obj });
				}
			}
			if (data[this.config.index]){
				for(var type in data[this.config.index].mappings) {
					scan_properties([type], data[this.config.index].mappings[type]);
				}
			}

			filters.sort( function(a, b) {
				var x = a.path.join(".");
				var y = b.path.join(".");
				return (x < y) ? -1 : (x > y) ? 1 : 0;
			});

			this.filters = [
				{ path: ["match_all"], type: "match_all", meta: {} },
				{ path: ["_all"], type: "_all", meta: {}}
			].concat(filters);

			// 存储所有原始过滤器供搜索使用
			this.allFilters = this.filters.slice(0);

			this._addFilterRow_handler();
		},
		
		_addFilterRow_handler: function() {
			this.filtersEl.append(this._filter_template());
		},
		
		_removeFilterRow_handler: function(jEv) {
			$(jEv.target).closest("DIV.uiFilterBrowser-row").remove();
			if(this.filtersEl.children().length === 0) {
				this._addFilterRow_handler();
			}
		},
		
		_search_handler: function() {
			var search = new data.BoolQuery();
			search.setSize( this.el.find(".uiFilterBrowser-outputSize").val() )
			this.fire("startingSearch");
			this.filtersEl.find(".uiFilterBrowser-row").each(function(i, row) {
				row = $(row);
				var bool = row.find(".bool").val();
				var field = row.find(".field").val();
				var op = row.find(".op").val();
				var value = {};
				if(field === "match_all") {
					op = "match_all";
				} else if(op === "range") {
					var lowqual = row.find(".lowqual").val(),
						highqual = row.find(".highqual").val();
					if(lowqual.length) {
						value[row.find(".lowop").val()] = lowqual;
					}
					if(highqual.length) {
						value[row.find(".highop").val()] = highqual;
					}
				} else if(op === "fuzzy") {
					var qual = row.find(".qual").val(),
						fuzzyqual = row.find(".fuzzyqual").val();
					if(qual.length) {
						value["value"] = qual;
					}
					if(fuzzyqual.length) {
						value[row.find(".fuzzyop").val()] = fuzzyqual;
					}
				} else {
					value = row.find(".qual").val();
				}
				search.addClause(value, field, op, bool);
			});
			if(this.el.find(".uiFilterBrowser-showSrc").attr("checked")) {
				this.fire("searchSource", search.search);
			}
			this._cluster.post( this.config.index + "/_search", search.getData(), this._results_handler );
		},
		
		_results_handler: function( data ) {
			var type = this.el.find(".uiFilterBrowser-outputFormat").val();
			this.fire("results", this, { type: type, data: data, metadata: this.metadata });
		},
		
		_changeQueryField_handler: function(jEv) {
			var select = $(jEv.target);
			var spec = select.children(":selected").data("spec");
			select.siblings().remove(".op,.qual,.range,.fuzzy");
			var ops = [];
			if(spec.type === 'match_all') {
			} else if(spec.type === '_all') {
				ops = ["query_string"];
			} else if(spec.type === 'string' || spec.type === 'text' || spec.type === 'keyword') {
				ops = ["match", "term", "wildcard", "prefix", "fuzzy", "range", "query_string", "text", "missing"];
			} else if(spec.type === 'long' || spec.type === 'integer' || spec.type === 'float' ||
					spec.type === 'byte' || spec.type === 'short' || spec.type === 'double') {
				ops = ["term", "range", "fuzzy", "query_string", "missing"];
			} else if(spec.type === 'date') {
				ops = ["term", "range", "fuzzy", "query_string", "missing"];
			} else if(spec.type === 'geo_point') {
				ops = ["missing"];
			} else if(spec.type === 'ip') {
				ops = ["term", "range", "fuzzy", "query_string", "missing"];
			} else if(spec.type === 'boolean') {
				ops = ["term"]
			}
			select.after({ tag: "SELECT", cls: "op", onchange: this._changeQueryOp_handler, children: ops.map(ut.option_template) });
			select.next().change();
		},
		
		_changeQueryOp_handler: function(jEv) {
			var op = $(jEv.target), opv = op.val();
			op.siblings().remove(".qual,.range,.fuzzy");
			if(opv === 'match' || opv === 'term' || opv === 'wildcard' || opv === 'prefix' || opv === "query_string" || opv === 'text') {
				op.after({ tag: "INPUT", cls: "qual", type: "text" });
			} else if(opv === 'range') {
				op.after(this._range_template());
			} else if(opv === 'fuzzy') {
				op.after(this._fuzzy_template());
			}
		},
		
		// 新增：字段过滤函数
		_filterFieldList_handler: function(jEv) {
			var input = $(jEv.target);
			var row = input.closest(".uiFilterBrowser-row");
			var searchText = input.val().toLowerCase();
			var fieldSelect = row.find(".field");
			
			// 重置过滤器列表
			this.filters = this.allFilters.slice(0);
			
			// 如果有搜索文本，则过滤列表
			if (searchText) {
				this.filters = this.allFilters.filter(function(filter) {
					return filter.path.join(".").toLowerCase().indexOf(searchText) !== -1;
				});
			}
			
			// 保存当前选中的值
			var currentValue = fieldSelect.val();
			
			// 清空并重新填充选择框
			fieldSelect.empty();
			var self = this;
			this.filters.forEach(function(filter) {
				fieldSelect.append($("<option></option>")
					.attr("value", filter.path.join("."))
					.text(filter.path.join("."))
					.data("spec", filter));
			});
			
			// 如果过滤后有结果
			if (this.filters.length > 0) {
				// 优先尝试保持当前选中值（如果它还存在于过滤结果中）
				if (this.filters.some(function(f) { return f.path.join(".") === currentValue; })) {
					fieldSelect.val(currentValue);
				} else {
					// 如果之前选中的值不在过滤结果中，则自动选中第一个过滤结果
					fieldSelect.val(this.filters[0].path.join("."));
				}
				
				// 手动触发change事件，激活选中字段的相关操作
				fieldSelect.trigger("change");
			}
		},
		
		_main_template: function() {
			return { tag: "DIV", children: [
				{ tag: "DIV", cls: "uiFilterBrowser-filters" },
				{ tag: "BUTTON", type: "button", text: i18n.text("General.Search"), onclick: this._search_handler },
				{ tag: "LABEL", children:
					i18n.complex("FilterBrowser.OutputType", { tag: "SELECT", cls: "uiFilterBrowser-outputFormat", children: [
						{ text: i18n.text("Output.JSON"), value: "json" },
						{ text: i18n.text("Output.Table"), value: "table" },
						{ text: i18n.text("Output.CSV"), value: "csv" }
					].map(function( o ) { return $.extend({ tag: "OPTION" }, o ); } ) } )
				},
				{ tag: "LABEL", children:
					i18n.complex("FilterBrowser.OutputSize", { tag: "SELECT", cls: "uiFilterBrowser-outputSize",
						children: [ "10", "50", "250", "1000", "5000", "25000" ].map( ut.option_template )
					} )
				},
				{ tag: "LABEL", children: [ { tag: "INPUT", type: "checkbox", cls: "uiFilterBrowser-showSrc" }, i18n.text("Output.ShowSource") ] }
			]};
		},
		
		_filter_template: function() {
			return { tag: "DIV", cls: "uiFilterBrowser-row", children: [
				{ tag: "SELECT", cls: "bool", children: ["must", "must_not", "should"].map(ut.option_template) },
				{ tag: "INPUT", type: "text", cls: "fieldFilter", placeholder: i18n.text("FilterBrowser.FilterFields") || "过滤字段...", onkeyup: this._filterFieldList_handler },
				{ tag: "SELECT", cls: "field", onchange: this._changeQueryField_handler, children: this.filters.map(function(f) {
					return { tag: "OPTION", data: { spec: f }, value: f.path.join("."), text: f.path.join(".") };
				})},
				{ tag: "BUTTON", type: "button", text: "+", onclick: this._addFilterRow_handler },
				{ tag: "BUTTON", type: "button", text: "-", onclick: this._removeFilterRow_handler }
			]};
		},
		
		_range_template: function() {
			return { tag: "SPAN", cls: "range", children: [
				{ tag: "SELECT", cls: "lowop", children: ["gt", "gte"].map(ut.option_template) },
				{ tag: "INPUT", type: "text", cls: "lowqual" },
				{ tag: "SELECT", cls: "highop", children: ["lt", "lte"].map(ut.option_template) },
				{ tag: "INPUT", type: "text", cls: "highqual" }
			]};
		},

		_fuzzy_template: function() {
			return { tag: "SPAN", cls: "fuzzy", children: [
				{ tag: "INPUT", cls: "qual", type: "text" },
				{ tag: "SELECT", cls: "fuzzyop", children: ["max_expansions", "min_similarity"].map(ut.option_template) },
				{ tag: "INPUT", cls: "fuzzyqual", type: "text" }
			]};
		}
	});
	
})( this.jQuery, this.app, this.i18n );
