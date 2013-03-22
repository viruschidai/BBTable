(function(){
	
	var PaginationModel = Backbone.PaginationModel = Backbone.Model.extend({
		defaults: {
			pageSize: 5,
			currentPage: 0,
			firstPage: 0,
			totalPages: 0,
			totalRecords: 0,
			sort: id, 
			dir: 1
		},
		
		initialize: function() {
			this.on({
				"change:totalRecords": function(model, totalRecords) {
					var pageSize = this.get("pageSize");
					
					var totalPages = this.get("pageSize") === 0 
									? (totalRecords > 0 ? 1 : 0)
									: Math.ceil(totalRecords/pageSize);
									
					this.set("totalPages", totalPages, {silent: true});
					
					if (this.get("currentPage") >= totalPages) {
						this.set("currentPage", (totalPages - 1));
					}
				}
			});
		},
		
		toQueryParameters: function() {
			return $.param(this.attributes);
		}
	});
	
	var PageableCollection = Backbone.PagebleCollection = Backbone.Collection.extend({
		initialize: function(options) {
			this.paginationModel = new PaginationModel();
			
			var PaginationStrategy = options.paginationStrategy || ClientSidePaginationStrategy;
			
			this.paginationStrategy = new PaginationStrategy({
				collection: this,
				paginationModel: this.paginationModel
			});
				
			this.listenTo(this.paginationModel, "change:currentPage", this.fetchCurrentPage);
		},
		
		fetchCurrentPage: function() {
			this.fetchPage(this.paginationModel.get("currentPage"));
			console.log("fetch current page");
		},
		
		fetchPage: function(pageIndex) {
			this.reset(this.paginationStrategy.fetchPage(pageIndex));
		}
	});
	
	var PaginationStrategy = Backbone.PaginationStrategy = function(options) {
		this.initialize.apply(this, arguments);
	};
	
	_.extend(PaginationStrategy.prototype, Backbone.Events, {
		initialize: function(options) {
			this.collection = options.collection;
			this.paginationModel = options.paginationModel;
		},
		
		fetchPage: function(pageIndex) {
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
		
		fetchPage: function(pageIndex) {
			if(this.dataFetched) {
				
			}
		},
		_fetchPage: function(pageIndex) {
			var pageSize = this.paginationModel.get("pageSize"),
			pageStart = pageIndex * pageSize;
		
			return this.fullCollection.models.slice(pageStart, pageSize);
		}
	});
	
}).call(this);