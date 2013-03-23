(function(){
	var BackTable;
	
	if (typeof exports !== 'undefined') {
		BackTable = exports;
	} else {
		BackTable = this.BackTable = {};
	}

	BackTable.VERSION = '0.0.1';
	
	var PaginationModel = BackTable.PaginationModel = Backbone.Model.extend({
		defaults: {
			pageSize: 10,
			currentPage: 0,
			firstPage: 0,
			totalPages: 0,
			totalRecords: 0
		},
		
		initialize: function() {
			this.on({
				"change:totalRecords change:pageSize": function() {
					var pageSize = this.get("pageSize"),
						totalRecords = this.get("totalRecords"),
						totalPages = this.get("pageSize") === 0 
									? (totalRecords > 0 ? 1 : 0)
									: Math.ceil(totalRecords/pageSize);
									
					this.set("totalPages", totalPages);
					
					if (this.get("currentPage") >= totalPages) {
						this.set("currentPage", (totalPages - 1));
					}
				}
			});
		},
		
		set: function(key, val, options) {
			options = options || {};
			options.validate = true;
			
			Backbone.Model.prototype.set.call(this, key, val, options);
		},
		
		validate: function(attrs, options) {
			if(attrs.pageSize < 0) {
				return "Invalid pageSize value [" + attrs.pageSize + "]";
			};
			
			if (attrs.currentPage < 0) {
				return "Invalid currentPage value [" + attrs.currentPage + "]";
			};
		}
	});
	
	var SortingModel = BackTable.SortingModel = Backbone.Model.extend({
		defaults: {
			sort: "id",
			desc: 1
		}
	});
	
	var PageableCollection = BackTable.PageableCollection = Backbone.Collection.extend({
		initialize: function(options) {
			this.paginationModel = new PaginationModel();
			
			var PaginationStrategy = options.paginationStrategy || ClientSidePaginationStrategy;
			
			this.paginationStrategy = new PaginationStrategy({
				collection: this,
				paginationModel: this.paginationModel
			});
				
			this.listenTo(this.paginationModel, "change:currentPage", this.fetchCurrentPage);
			this.listenTo(this.paginationModel, "change:pageSize", this.fetchCurrentPage);
			this.listenTo(this.paginationModel, "change:totalPages", this.fetchCurrentPage);
		},
		
		fetchCurrentPage: function() {
			this.fetchPage(this.paginationModel.get("currentPage"));
		},
		
		fetchPage: function(pageIndex) {
			var callback = function(models) {
				this.reset(models);
			};
			
			this.paginationStrategy.fetchPage(pageIndex, callback, this);
		}
		
	});
	
	var PaginationStrategy = BackTable.PaginationStrategy = function(options) {
		this.initialize.apply(this, arguments);
	};
	
	_.extend(PaginationStrategy.prototype, Backbone.Events, {
		initialize: function(options) {
			this.collection = options.collection;
			this.paginationModel = options.paginationModel;
		},
		
		fetchPage: function(pageIndex, callback, context) {
			throw "Please implement this method in child classes";
		}
	});
	
	PaginationStrategy.extend = Backbone.Model.extend;
	
	var ClientSidePaginationStrategy = PaginationStrategy.extend({
		initialize: function(options) {
			PaginationStrategy.prototype.initialize.apply(this, arguments);

			// fullCollection to hold all records
			this.dataFetched = false;
			var _this = this;
			
			var FullCollection = Backbone.Collection.extend({
				model: _this.collection.model,
				url: _this.collection.url
			});
			
			this.fullCollection = new FullCollection();
			
			this.fullCollection.fetch({
				success: function() {
					_this.dataFetched = true;
				}
			});
			
			this.listenTo(this.fullCollection, "reset", function() {
				console.log("full collection reset");
				this.paginationModel.set("totalRecords", this.fullCollection.length); 
			});
		},
		
		fetchPage: function(pageIndex, callback, context) {
			var _this = this;
			
			if(!this.dataFetched) {
				this.fullCollection.once("reset", function() {
					callback.call(this, _this._fetchPage(pageIndex));
				}, context);
			} else {
				callback.call(context, this._fetchPage(pageIndex));
			}
		},
		
		_fetchPage: function(pageIndex) {
			var pageSize = this.paginationModel.get("pageSize"),
				pageStart = pageIndex * pageSize;
		
			return this.fullCollection.models.slice(pageStart, pageStart + pageSize);
		}
	});
	
	var PaginatorView = BackTable.PaginatorView = Backbone.View.extend({
		tagName: "div",
		
		windowSize: 5,
		
		className: "paginator",
		
		fastForwardings: {
			"first": "<<",
			"last": ">>",
			"prev": "<",
			"next": ">"
		},
		
		pageSizeOptions: ['All', 10, 20],
		
		template: _.template(
				"<div class='pagination'>"
				+ "<ul class='pagesize-selector'>"
				+ "	<% _.each(pageSizes, function(size) { %>"
				+ "	<li class='page-size <%= pageSize==size ? \'active\' : \'\' %>'><a href='#'><%= size %></a></li>"
				+ " <% }) %>"
				+ "</ul>"
				+ "	<ul class='page-selector'>"
				+ "	<% _.each(pages, function(page) { %>"
				+ " 	<li class='page <%= page.cssClass %>'><a href='#'><%= page.label %></a></li>"
				+ " <% }) %>"
				+ "	</ul>"
				+ "</div>"
		),
		
		events: {
			"click .page": "onClickChangePage",
			"click .page-size": "onClickChangePageSize"
		},
		
		initialize: function() {
			this.listenTo(this.model, "change", this.render);
		},
		
		render: function() {
			this.$el.empty();
			var pages = this.getDisplayPages();
			
			var paginatorInfo = {
				displayedPage: this.model.get("currentPage") + 1,
				pageSizes: this.pageSizeOptions,
				pages: pages,
				totalPages: this.model.get("totalPages"),
				pageSize: this.model.get("pageSize")
			};
			
			this.$el.html(this.template(paginatorInfo));
			return this;
		},
		
		getDisplayPages: function() {
			if(this.model.get("totalPages") > 0) {
				var currentPage = this.model.get("currentPage"),
					totalPages = this.model.get("totalPages"),
					startPage = Math.max(1, currentPage + 1 - parseInt(this.windowSize/2)),
					endPage = Math.min(this.model.get("totalPages")+1, startPage + this.windowSize);
					
				var result = [
					{label: this.fastForwardings.first, cssClass: currentPage == 0 ? "disabled" : ""},
					{label: this.fastForwardings.prev, cssClass: currentPage == 0 ? "disabled" : ""},
				];
				
				var range = _.range(startPage, endPage, 1);
				_.each(range, function(pageNum) {
					result.push({label: pageNum, cssClass: currentPage + 1 == pageNum ? "active" : ""});
				});
				
				result = result.concat([
					{label: this.fastForwardings.next, cssClass: currentPage + 1 == totalPages ? "disabled" : ""},
					{label: this.fastForwardings.last, cssClass: currentPage + 1 == totalPages ? "disabled" : ""},
				]);
				
				return result;
			} else {
				return [];
			}
		},
		
		onClickChangePage: function(ev) {
			var pageStr = $(ev.target).text().trim();
			var pageIndex = this.convertPageIndex(pageStr);
			this.model.set("currentPage", pageIndex);
		},
		
		convertPageIndex: function(pageStr) {
			var page = 0,
				currentPage = this.model.get("currentPage"),
				totalPages = this.model.get("totalPages");
			
			switch(pageStr){
				case this.fastForwardings.first:
					page = Math.min(0, totalPages - 1);
					break;
				case this.fastForwardings.prev: 
					page = Math.max(0, currentPage - 1);
					break;
				case this.fastForwardings.next:
					page = Math.min(currentPage + 1, totalPages - 1);
					break;
				case this.fastForwardings.last:
					page = Math.max(0, totalPages - 1);
					break;
				default: 
					page = parseInt(pageStr) - 1;
			}
			
			return page;
		},
		
		onClickChangePageSize: function(ev) {
			var pageSizeStr = $(ev.target).text().trim(); 
			var pageSize = this.convertPageSize(pageSizeStr);
			
			this.model.set("pageSize", pageSize);
		},
		
		convertPageSize: function(pageSizeStr) {
			var pageSize = 0;
			
			if (pageSizeStr == "All") {
				pageSize = 0;
			} else {
				pageSize = parseInt(pageSizeStr);
			};
			
			return pageSize;
		}
	});
	
	var Column = BackTable.Column = Backbone.Model.extend({
		defaults: {
			key: undefined,
			label: undefined,
			sortable: true,
			editable: true,
			renderable: true,
			formatter: undefined,
			celleditor: undefined
		}
	});
	
	var Columns = BackTable.Columns = Backbone.Collection.extend({
		model: Column
	});
	
	var Cell = BackTable.Cell = Backbone.View.extend({
		tagName: "td",
		
		initialize: function(options) {
			this.column = options.column;
			this.model = options.model;
		},
		
		render: function() {
			this.$el.html(this.model.get(this.column.get('key')));
			return this;
		}
	});
	
	var HeaderCell = BackTable.HeaderCell = Backbone.View.extend({
		tagName: "td",
		
		initialize: function(options) {
			this.column = options.column;
		},
		
		render: function() {
			this.$el.html(this.column.get('label'));
			return this;
		}
	});
	
	var TableRow = BackTable.TableRow = Backbone.View.extend({
		tagName: "tr",
		
		initialize: function(options) {
			this.columns = options.columns;
			this.model = options.model;
		},
		
		render: function() {
			_.each(this.columns.models, function(column) {
				var cell = new Cell({
					column: column,
					model: this.model
				});
				
				this.$el.append(cell.render().el);
			}, this);
			
			return this;
		}
	});
	
	var TableHeaderRow = BackTable.TableHeaderRow = Backbone.View.extend({
		tagName: "tr",
		
		initialize: function(options) {
			this.columns = options.columns;
		},
		
		render: function() {
			_.each(this.columns.models, function(column) {
				var cell = new HeaderCell({
					column: column
				});
				
				this.$el.append(cell.render().el);
			}, this);
			
			return this;
		}
	});

	var TableHeader = BackTable.TableHeader = Backbone.View.extend({
		tagName: "thead",
		
		initialize: function(options) {
			this.columns = options.columns;
			this.collection = options.collection;
			
			this.row = new TableHeaderRow({
				columns: this.columns,
				collection: this.collection
			});
		},
		
		render: function() {
			this.$el.append(this.row.render().el);
			
			return this;
		}
	});
	
	var TableBody = BackTable.TableBody = Backbone.View.extend({
		tagName: "tbody",
		
		initialize: function(options) {
			this.columns = options.columns;
			this.collection = options.collection;
			
			this.listenTo(this.collection, "reset", this.render);
			this.listenTo(this.collection, "add", this.insertRow);
		},
		
		insertRow: function(model) {
			var row = new TableRow({
				columns: this.columns,
				model: model
			});
			
			var rowHtml = row.render().el;
			
			if ( this.$el.find('>tr').length === 0 ) {
				this.$el.append(rowHtml);
			} else {
				var index = this.collection.indexOf(model);
				this.$el.find('> tr').eq(index-1).after(rowHtml);	
			}
		},	
		
		render: function() {
			this.$el.empty();
			
			_.each(this.collection.models, function(model) {
				var row = new TableRow({
					columns: this.columns,
					model: model
				});
				
				this.$el.append(row.render().el);
			}, this);
			
			return this;
		}
	});
	
	var Table = BackTable.Table = Backbone.View.extend({
		
		tagName: "table",
		
		className: "table table-striped table-bordered backbone-table",
		
		header: null,
		
		body: null,
		
		initialize: function(options) {
			options.columns = this._convertColumns(options.columns);
			
			this.columns = options.columns || {};
			this.collection = options.collection || {};
			
			this.body = options.body || new TableBody(options);
			this.header = options.header || new TableHeader(options);
		},
		
		render: function() {
			if(this.header) {
				this.$el.append(this.header.render().el);
			};
			
			if (this.body) {
				this.$el.append(this.body.render().el);
			};
			
			return this;
		},
		
		_convertColumns: function(columns) {
			if (!(columns instanceof Columns)) {
				var converted_columns = _.map(columns, function(column) {
					var model = new Column();
					model.set(column);
					return model;
				}, this);
				
				return new Columns(converted_columns);
			} ;
			
			return columns;
		}
	});
	
}).call(this);