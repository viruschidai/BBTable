(function(){
    var PageableCollection = Backbone.PagebleCollection = Backbone.Collection.extend({
        
    });
    
    var PaginationModel = Backbone.PaginationModel = Backbone.Model.extend({
        defaults: {
            pageSize: 5,
            currentPage: 0,
            firstPage: 0,
            totalPages: 0,
            totalRecords: 0
        }
    });
    
    var PaginationStrategy = function(options) {
        this.initialize.apply(this, arguments);
    };
    
    _.extend(PaginationStrategy.prototype, Backbone.Events, {
        model: PaginationModel,
        
        initialize: function(options) {
            this.collection = options.collection;
        },
        
        getPage: function(page) {
               
        }
    });
    
    var ClientSidePaginationStrategy = _.extend({
        model: PaginationModel,
        
        getPage: function(page) {
               
        }
    }, Backbone.Events);
    
}).call(this);