(function(){
	var Column = Backbone.Column = Backbone.Model.extend({
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
	
	var Columns = Backbone.Columns = Backbone.Collection.extend({
		model: Column
	});
	
	var Cell = Backbone.Cell = Backbone.View.extend({
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
	
	var HeaderCell = Backbone.HeaderCell = Backbone.View.extend({
        tagName: "td",
        
        initialize: function(options) {
    		this.column = options.column;
		},
        
		render: function() {
			this.$el.html(this.column.get('label'));
			return this;
		}
	});
	
	var TableRow = Backbone.TableRow = Backbone.View.extend({
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
	
	var TableHeaderRow = Backbone.TableHeaderRow = Backbone.View.extend({
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

	var TableHeader = Backbone.TableHeader = Backbone.View.extend({
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
	
	var TableBody = Backbone.TableBody = Backbone.View.extend({
		tagName: "tbody",
		
		initialize: function(options) {
			this.columns = options.columns;
			this.collection = options.collection;
			
			this.listenTo(this.collection, "reset", this.render);
			this.listenTo(this.collection, "add", this.insertRow);
		},
		
		insertRow: function(model) {
			console.log('insert row');
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
	
	var Table = Backbone.Table = Backbone.View.extend({
		
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