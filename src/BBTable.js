;/**
 * @author billg(viruschidai@gmail.com)
 * This is a backbone.js based table widget.
 */
(function() {
    var BBTable;

    if (typeof exports !== "undefined") {
        BBTable = exports;
    } else {
        BBTable = this.BBTable = {};
    }

    BBTable.VERSION = "0.0.1";

    /*
    * Make sure attributes are validated when set. It is no longer the default behaviour of Backbone.js.
    */
    BBTable.Model = Backbone.Model.extend({
        set: function(key, val, options) {
            options = options || {};
            options.validate = true;

            Backbone.Model.prototype.set.call(this, key, val, options);
        }
    });

    var PaginationModel = BBTable.PaginationModel = BBTable.Model.extend({
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
                                    : Math.ceil(totalRecords / pageSize);

                    this.set("totalPages", totalPages);

                    if (this.get("currentPage") >= totalPages) {
                        this.set("currentPage", (totalPages - 1));
                    }
                }
            });
        },

        validate: function(attrs, options) {
            if (attrs.pageSize < 0) {
                return "Invalid pageSize value [" + attrs.pageSize + "]";
            };

            if (attrs.currentPage < 0) {
                return "Invalid currentPage value [" + attrs.currentPage + "]";
            };
        }
    });

    function getDefaultComparator(key, dir) {
        return function(left, right) {
            var a = left.get(key),
                b = right.get(key);
            
            if (a > b) {
                return dir === "asc" ? 1 : -1;
            }
            
            if (a < b){
                return dir === "desc" ? 1 : -1;
            }
            
            return 0;
        };
    };

    function fastProcessJobs(jobs, process, batchSize, context) {
        var iterations = Math.floor(jobs.length / batchSize),
        leftover = jobs.length % batchSize,
        i = 0
        timers = [];

        if (leftover > 0){
            do {
                process.call(context, jobs[i++]);
            } while (--leftover > 0);
        }

        function batchJob(startIndex) {
            return function() {
                for (var j=0; j<batchSize; j++) {
                    process.call(context, jobs[startIndex + j]);    
                }    
            };
        }

        var totalIterations = iterations;
        
        do {
            var batchFunc = batchJob(i);
            timers.push(setTimeout(batchFunc, 10));
            i += batchSize;
        } while (--iterations > 0);

        return timers;
    };
    
    var SortingModel = BBTable.SortingModel = BBTable.Model.extend({
        defaults: {
            sortKey: null,
            dir: "none",
            comparator: null
        } 
    });

    var PageableCollection = BBTable.PageableCollection = Backbone.Collection.extend({
        initialize: function(options) {
            this.paginationModel = new PaginationModel();
            this.sortingModel = new SortingModel();

            var PaginationStrategy = options.paginationStrategy || ClientSidePaginationStrategy;

            this.paginationStrategy = new PaginationStrategy({
                collection: this,
                paginationModel: this.paginationModel
            });

            this.listenTo(this.paginationModel, "change:currentPage", this.fetchCurrentPage);
            this.listenTo(this.paginationModel, "change:pageSize", this.fetchCurrentPage);
            this.listenTo(this.paginationModel, "change:totalPages", this.fetchCurrentPage);
            
            this.listenTo(this.sortingModel, "change", this.sort);
        },

        fetchCurrentPage: function() {
            this.fetchPage(this.paginationModel.get("currentPage"));
        },

        fetchPage: function(pageIndex) {
            var callback = function(models) {
                this.reset(models);
            };

            this.paginationStrategy.fetchPage(pageIndex, callback, this);
        },
        
        sort: function() {
            this.paginationStrategy.sort(this.sortingModel);
            this.fetchCurrentPage();
        },
        
        destroy: function() {
            this.paginationStrategy.destroy();
            Backbone.Collection.prototype.destroy.call(this);
        }

    });

    var PaginationStrategy = BBTable.PaginationStrategy = function(options) {
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

            if (pageSize === 0) {
                return this.fullCollection.models;
            } else {
                return this.fullCollection.models.slice(pageStart, pageStart + pageSize);
            }
        },
        
        sort: function(sortingModel) {
            this.fullCollection.comparator = sortingModel.get("comparator");
            this.fullCollection.sort({sort: false});
        }
    });

    var PageSizeSelectorView = BBTable.PageSizeSelectorView = Backbone.View.extend({
        tagName: "div",
        className: "pagesize-selector",

        pageSizeOptions: ['All', 10, 20],

        template: _.template(
                "<div class='pagination'>"
                + "<ul class='pagesize-selector'>"
                + " <% _.each(pageSizes, function(size) { %>"
                + " <li class='page-size <%= pageSize==size ? \'active\' : \'\' %>'><a href='#'><%= size %></a></li>"
                + " <% }) %>"
                + "</ul>"
                + "</div>"),

        events: {
            "click .page-size": "onClickChangePageSize"
        },
        
        initialize: function() {
            this.listenTo(this.model, "change", this.render);
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
        },

        render: function() {
            this.$el.empty();
            var pageSize = this.model.get("pageSize");

            var pageSizeInfo = {
                pageSizes: this.pageSizeOptions,
                pageSize: pageSize === 0 ? "All" : pageSize
            };

            this.$el.html(this.template(pageSizeInfo));
            return this;
        }

    });

    var PaginatorView = BBTable.PaginatorView = Backbone.View.extend({
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
                + " <ul class='page-selector'>"
                + " <% _.each(pages, function(page) { %>"
                + "     <li class='page <%= page.cssClass %>'><a href='#'><%= page.label %></a></li>"
                + " <% }) %>"
                + " </ul>"
                + "<span class='page-records-info label label-info pull-right'><%= startIndex %> - <%= endIndex %> of <%= totalRecords %></span>"
                + "</div>"
        ),

        events: {
            "click .page": "onClickChangePage"
        },

        initialize: function() {
            this.listenTo(this.model, "change", this.render);
        },

        render: function() {
            this.$el.empty();
            var pages = this.getDisplayPages(),
                pageSize = this.model.get("pageSize"),
                currentPage = this.model.get("currentPage"),
                totalRecords = this.model.get("totalRecords");

            var paginatorInfo = {
                displayedPage: currentPage + 1,
                pageSizes: this.pageSizeOptions,
                pages: pages,
                totalPages: this.model.get("totalPages"),
                pageSize: pageSize === 0 ? "All" : pageSize,
                totalRecords: totalRecords,
                startIndex: Math.min(currentPage * pageSize + 1, totalRecords),
                endIndex: pageSize === 0 ? totalRecords : Math.min((currentPage + 1) * pageSize, totalRecords)
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
        }


    });

    var Column = BBTable.Column = Backbone.Model.extend({
        defaults: {
            key: undefined,
            label: undefined,
            sortable: true,
            editable: true,
            renderable: true,
            formatter: undefined,
            cellEditor: undefined
        },
        
        initialize: function() {
            var cellEditor = this.get("cellEditor");
            
            if (cellEditor) {
                this.on(this.get("key") + ":edit", function(cell, column, model) {
                    var editor = new cellEditor({model: model, column: column, cell: cell});
                }, cellEditor);
            }
        }
    });

    var Columns = BBTable.Columns = Backbone.Collection.extend({
        model: Column
    });

    var Cell = BBTable.Cell = Backbone.View.extend({
        tagName: "td",
        
        events: {
            "dblclick": "edit"
        },

        toRaw: function() {
            return this.$el.html();
        },

        fromRaw: function() {
            return this.model.get(this.column.get('key'));
        },

        initialize: function(options) {
            this.column = options.column;
            this.model = options.model;
        },

        render: function() {
            this.$el.html(this.fromRaw());
            return this;
        },
        
        edit: function(ev) {
            this.column.trigger(this.column.get("key") + ":edit", this.$el, this.column, this.model);
        }
    });

    var HeaderCell = BBTable.HeaderCell = Backbone.View.extend({
        tagName: "th",
        
        events: {
            "click": "sort"
        },
        
        template: _.template("<div>"
                + "<%= content %>"
                + "<% if (sortable) { %>"
                + "<div class='sorting sorting-<%= dir %> pull-right'>"
                +       "<i class='<%= sortingClass %>'>"
                + "</div>"
                + "<% } %>"),

        initialize: function(options) {
            this.column = options.column;
            this.sortingModel = options.sortingModel;

            this.listenTo(this.sortingModel, "change", this.render);
        },

        render: function() {
            var sortingClass = this._getSortingClass(),
                dir = this.sortingModel.get("dir"),
                sortable = this.column.get("sortable");

            this.$el.html(this.template({
                content: this.column.get("label"),
                sortable: sortable,
                sortingClass: sortingClass,
                dir: dir
            }));
            
            if (sortable) {
                this.$el.addClass("sortable");  
            };

            return this;
        },
        
        sort: function() {
            if (this.column.get("sortable")) {
                var dir = this.$el.find("div.sorting").attr("class").split(" ")[1].split("-")[1].trim(),
                    key = this.column.get("key"); 
                    
                if ( (dir === "none") || (dir === "desc") ) {
                    dir = "asc";
                } else {
                    dir = "desc";
                }
                        
                this.sortingModel.set({
                    "dir": dir,
                    "sortKey": key,
                    "comparator": this.column.get("comparator") ? this.column.get("comparator") : getDefaultComparator(key, dir)
                });
            }
        },

        _getSortingClass: function() {
            if (this.sortingModel.get("sortKey") != this.column.get("key")) {
                return "icon-unsorted";
            };
                
            switch (this.sortingModel.get("dir")) {
                case "asc": return "icon-chevron-up";
                case "desc": return "icon-chevron-down";
                default: return "icon-unsorted";
            }
        }
    });

    var TableRow = BBTable.TableRow = Backbone.View.extend({
        tagName: "tr",

        initialize: function(options) {
            this.columns = options.columns;
            this.model = options.model;
            this.listenTo(this.model, "change", this.render);
        },

        render: function() {
            this.$el.empty();
            
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

    var TableHeaderRow = BBTable.TableHeaderRow = Backbone.View.extend({
        tagName: "tr",

        initialize: function(options) {
            this.columns = options.columns;
            this.collection = options.collection;
        },

        render: function() {
            _.each(this.columns.models, function(column) {
                var cell = new HeaderCell({
                    column: column,
                    sortingModel: this.collection.sortingModel
                });

                this.$el.append(cell.render().el);
            }, this);

            return this;
        }
    });

    var TableHeader = BBTable.TableHeader = Backbone.View.extend({
        tagName: "thead",

        initialize: function(options) {
            this.columns = options.columns;
            this.collection = options.collection;

            this.row = new TableHeaderRow({
                columns: this.columns,
                collection: this.collection,
            });
        },

        render: function() {
            this.$el.append(this.row.render().el);

            return this;
        }
    });

    var TableBody = BBTable.TableBody = Backbone.View.extend({
        tagName: "tbody",

        initialize: function(options) {
            this.columns = options.columns;
            this.collection = options.collection;
            this.renderTimers = [];

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
                this.$el.find('>tr').eq(index-1).after(rowHtml);
            }
        },

        clearTimers: function() {
            for(var i=0; i<this.renderTimers.length; i++) {
                clearTimeout(this.renderTimers[i]);
            };
            this.renderTimers = [];
        },

        render: function() {
            this.$el.empty();
            this.clearTimers();          
            
            this.renderTimers = fastProcessJobs(this.collection.models, function(model) {
                var row = new TableRow({
                    columns: this.columns,
                    model: model
                });

                this.$el.append(row.render().el);
            }, 100, this);
            
            return this;
        }
    });

    var Table = BBTable.Table = Backbone.View.extend({

        tagName: "table",

        className: "bbtable",

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
                    var model = new Column(column);
                    return model;
                }, this);

                return new Columns(converted_columns);
            };

            return columns;
        }
    });
    
    var CellEditor = BBTable.CellEditor = Backbone.View.extend({
        tagName: "div",
        
        className: "cell-editor"
    });
    
    var InputCellEditor = BBTable.InputCellEditor = CellEditor.extend({
        events: {
            "blur input": "blur",
            "keypress input": "keypress"
        },
        
        template: _.template("<input type='text' value=<%= value %>>"),
        
        initialize: function(options) {
            this.cell = options.cell;
            this.column = options.column;
            
            this.render();
            $(document.body).append(this.el);
            this.$input = this.$el.find("input");
            this.show();
        },
        
        render: function() {
            this.$el.append(this.template({value: this.model.get(this.column.get("key"))}));
            return this;
        },
        
        keypress: function(ev) {
            if(ev.keyCode === 13) {
                this.updateModel();
                this.remove();
            } else if (ev.keyCode === 27) {
                this.remove();
            }
        },
        
        show: function() {
            this.$el.offset(this.cell.offset());
            this.$input.outerHeight(this.cell.outerHeight());
            this.$input.outerWidth(this.cell.outerWidth());
            
            this.$input.focus();
            this.$input.select();
        },
        
        // Update model with edited value
        updateModel: function() {
            this.model.set(this.column.get("key"), this.$input.val());
        },
        
        blur: function() {
            this.updateModel();
            this.remove();
        }
    });

}).call(this);