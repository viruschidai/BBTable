;/**
  * @author billg(viruschidai@gmail.com)
  * This is a backbone.js based table widget.
  */
(function() {
  var BBLib;

  if (!this.BBLib) {
    BBLib = this.BBLib = {}
    BBLib.VERSION = '0.1.0';
  } else {
    BBLib = this.BBLib;
  }

  var events = _.extend({}, Backbone.Events)

  var requiredOptions = function(options, required) {
    required.forEach(function(option) {
      if (!(option in options)) {
        throw new Error('option.' + option + ' is required!');
      }
    });
  };

  // A model that controls sorting
  var SortingModel = BBLib.SortingModel = Backbone.Model.extend({
    defaults: {
      sortDir: 'asc',
      sortKey: 'id',
      comparator: null
    },

    getSortDirAsString: function() {
      switch (this.get('sortDir')) {
        case 1: return 'asc';
        case -1: return 'desc';
        default: return 'unsorted';
      }
    }
  });

  function getDefaultComparator(key, dir) {
    return function(left, right) {
      var a = left.get(key),
          b = right.get(key);

      if (a > b) {
        return dir === 'asc' ? 1 : -1;
      }

      if (a < b){
        return dir === 'desc' ? 1 : -1;
      }

      return 0;
    };
  };

  var ClientSidePageable = BBLib.ClientSidePageable = Backbone.Collection.extend({
    initialize: function(options) {
      this.paginationModel = options.paginationModel || new PaginationModel();
      this.sortingModel = options.sortingModel || new SortingModel();
      this.cachedResults = new Backbone.Collection();
      this.comparator = options.comparator || getDefaultComparator;

      this.paginationModel.on('change:page change:pageSize', function(e) {
        this.reset(this._getCurrentPage());
      }, this);

      this.sortingModel.on('change', function(e) {
        this.cachedResults.comparator = this.comparator(this.sortingModel.get('sortKey'), this.sortingModel.get('sortDir'));
        this.cachedResults.sort({sort: false});
        this.reset(this._getCurrentPage());
      }, this);
    },

    parse: function(res, options) {
      this.paginationModel.set('numOfRecords', res.length);
      this.cachedResults.reset(res)
      return this._getCurrentPage();
    },

    _getCurrentPage: function() {
      var currentPage = this.paginationModel.get('page');
      return this._getPage(currentPage);
    },

    _getPage: function(page) {
      var pageSize = this.paginationModel.get('pageSize'),
          pageStart = page * pageSize;

      if (pageSize === 0) {
          return this.cachedResults;
      } else {
          return this.cachedResults.slice(pageStart, pageStart + pageSize);
      }
    }
  });

  var ServerSidePageable = BBLib.ServerSidePageable = Backbone.Collection.extend({
    initialize: function(options) {
      this.paginationModel = options.paginationModel || new PaginationModel();
      this.sortingModel = options.sortingModel || new SortingModel();

      this.paginationModel.on('change:page change:pageSize', function() {
        this.fetch();
      }, this);

      this.sortingModel.on('change', function(e) {
        this.fetch();
      }, this);
    },

    fetch: function() {
      arguments.data = _.defaults({}, this.paginationModel.attributes, this.sortingModel.attributes, arguments.data);
      return Backbone.Collection.prototype.fetch.call(this, arguments);
    },

    parse: function(res, options){
      this.paginationModel.set('numOfRecords', res.numOfRecords);
      return res.page;
    }
  });

  var Column = BBLib.Column = Backbone.Model.extend({
    defaults: {
      key: undefined,
      label: undefined,
      sortable: true,
      editable: false,
      renderable: true,
      cell: Cell,
      cellEditorClass: undefined
    },

    onCellEdit: function(cell, model) {
      var CellEditor = this.get('cellEditorClass') || InputCellEditor
      new CellEditor({cell: cell, model: model, col: this});
    },

    initialize: function() {
      if (this.get('editable')) {
        this.on('cell:edit', this.onCellEdit, this)
      }
    }
  });

  var PaginationModel = BBLib.PaginationModel = Backbone.Model.extend({
    defaults: {
      pageSize: 10,
      page: 0,
      numOfPages: 0,
      numOfRecords: 0
    },

    initialize: function() {
      this.on('change:numOfRecords change:pageSize', function() {
        var pageSize = this.get('pageSize'),
          numOfRecords = this.get('numOfRecords'),
          numOfPages = this.get('pageSize') === 0 ? (numOfRecords > 0 ? 1 : 0) : Math.ceil(numOfRecords / pageSize);

        this.set('numOfPages', numOfPages);

        if (this.get('page') >= numOfPages) {
          this.set('page', (numOfPages - 1));
        }
      });
    },

    queryParamsMap: {},

    toQueryParams: function() {
      var params = _.extend({}, this.attributes);

      if (_.empty(this.queryParamsMap)) return params; 

      _.each(this.queryParamsMap, function(key, value) {
        if (! value in this.attributes) {
          throw new Error(value + ' is not a valid property.');
        };
        params[key] = this.attributes[value];
      });

      return params;
    },

    validate: function(attrs, options) {
      if (attrs.pageSize < 0) {
          return 'Invalid pageSize value [' + attrs.pageSize + ']';
      };

      if (attrs.page < 0 || attrs.page > this.get('numOfPages') - 1) {
          return 'Invalid currentPage value [' + attrs.currentPage + ']';
      };
    }
  });

  var PageSelectorView = BBLib.PageSelectorView = Backbone.View.extend({
    tagName: 'div',

    windowSize: 5,

    className: 'pagination numbers',

    fastForwardings: {
      'first': '<<',
      'last': '>>',
      'prev': '<',
      'next': '>'
    },

    template: _.template("<ul class='page-selector'>"
                + "	<% _.each(pages, function(page) { %>"
                + " 	<li class='page <%= page.cssClass %>'><a href='#'><%= page.label %></a></li>"
                + " <% }) %>"
                + "	</ul>"
                ),

    events: {
      'click .page': 'onClickChangePage'
    },

    initialize: function(options) {
      options = options || {}
      this.windowSize = options.windowSize || this.windowSize;
      _.bindAll(this, 'render');
      this.model.on('change:numOfPages change:page', this.render, this)
    },

    render: function() {
      this.$el.empty();
      pages = this.getDisplayPages();
      this.$el.html(this.template(pages));
      return this;
    },

    getDisplayPages: function() {

      if(!(this.model.get('numOfPages') > 0)) return []

      var page = this.model.get('page'),
        numOfPages = this.model.get('numOfPages'),
        startPage = Math.max(1, Math.min(page + 1 - parseInt(this.windowSize/2), numOfPages + 1 - this.windowSize)),
        endPage = Math.min(this.model.get('numOfPages')+1, startPage + this.windowSize);

      var result = [
        {label: this.fastForwardings.first, cssClass: page == 0 ? 'disabled' : ''},
        {label: this.fastForwardings.prev, cssClass: page == 0 ? 'disabled' : ''},
      ];

      var range = _.range(startPage, endPage, 1);

      _.each(range, function(pageNum) {
        result.push({label: pageNum, cssClass: page + 1 === pageNum ? 'active' : ''});
      });

      return result.concat([
          {label: this.fastForwardings.next, cssClass: page + 1 == numOfPages ? 'disabled' : ''},
          {label: this.fastForwardings.last, cssClass: page + 1 == numOfPages ? 'disabled' : ''},
        ]);
      
    },

    onClickChangePage: function(ev) {
      ev.preventDefault();
      ev.stopPropagation();

      var pageStr = $(ev.target).text().trim();
      var pageIndex = this.convertPageIndex(pageStr);
      this.model.set('page', pageIndex, {validate: true});
    },

    convertPageIndex: function(pageStr) {
      var page = 0,
      page = this.model.get('page'),
      numOfPages = this.model.get('numOfPages');

      switch(pageStr){
        case this.fastForwardings.first:
          page = Math.min(0, numOfPages - 1);
          break;
        case this.fastForwardings.prev:
          page = Math.max(0, page - 1);
          break;
        case this.fastForwardings.next:
          page = Math.min(page + 1, numOfPages - 1);
          break;
        case this.fastForwardings.last:
          page = Math.max(0, numOfPages - 1);
          break;
        default:
          page = parseInt(pageStr) - 1;
      }

      return page;
    }

  });

  var GotoPageView = BBLib.GotoPageView= Backbone.View.extend({
    tagName: 'div',

    className: 'pagination goto',

    events: {
      'blur input': 'changePage',
      'keypress input': 'changePageOnEnter'
    },

    template: _.template("Goto <input type='text' value='<%= page + 1 %>'/> of <%= numOfPages %>"),

    initialize: function() {
      _.bindAll(this, 'render');
      this.model.on('change', this.render, this);
    },

    render: function() {
      this.$el.empty();
      this.$el.html(this.template(this.model.attributes));
      return this;
    },

    changePage: function(ev) {
      var pageStr = $(ev.target).val();
      var pageIndex = +pageStr - 1;

      if (_.isNaN(pageIndex) || pageIndex <= 0 || (pageIndex > (this.model.get('numOfPages') - 1))) {
        $(ev.target).val(this.model.get('page') + 1);
      };
      this.model.set('page', pageIndex, {validate: true});
    },

    changePageOnEnter: function(ev) {
      if (ev.keyCode != 13) return;
      this.changePage(ev);
    }
  });

  var PageSizeSelectorView = BBLib.PageSizeSelectorView = Backbone.View.extend({
    tagName: 'div',
      className: 'pagesize-selector',

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
        'click .page-size': 'onClickChangePageSize'
      },

      initialize: function() {
        _.bindAll(this, 'render');
        this.model.on('change', this.render)
      },

      onClickChangePageSize: function(ev) {
        var pageSizeStr = $(ev.target).text().trim();
        var pageSize = this.convertPageSize(pageSizeStr);

        this.model.set('pageSize', pageSize);
      },

      convertPageSize: function(pageSizeStr) {
        var pageSize = 0;

        if (pageSizeStr == 'All') {
          pageSize = 0;
        } else {
          pageSize = parseInt(pageSizeStr);
        };

        return pageSize;
      },

      render: function() {
        this.$el.empty();
        var pageSize = this.model.get('pageSize');

        var pageSizeInfo = {
          pageSizes: this.pageSizeOptions,
          pageSize: pageSize === 0 ? 'All' : pageSize
        };

        this.$el.html(this.template(pageSizeInfo));
        return this;
      }
  });


  var PaginatorView = BBLib.PaginatorView = Backbone.View.extend({
    tagName: 'div',

    className: 'paginator',

    initialize: function(options) {
      this.pageSelector = new PageSelectorView({model: this.model});
      this.gotoPage = new GotoPageView({model: this.model});
    },

    render: function() {
      this.$el.empty();
      this.$el.append(this.pageSelector.render().el);

      var gotoEl = this.gotoPage.render().el;
      $(gotoEl).addClass('pull-right');
      this.$el.append(this.gotoPage.render().el);

      return this;
    }
  });


  var Columns = BBLib.Columns = Backbone.Collection.extend({
    model: Column
  });

  var Cell = BBLib.Cell = Backbone.View.extend({
    tagName: 'td',

    className: 'bbtable-cell',

    events: {
      'dblclick': 'onClick'
    },

    initialize: function(options){
      requiredOptions(options, ['col']);
      this.col = options.col;
      _.bindAll(this, 'render', 'onClick');
    },

    render: function() {
      this.$el.html(this.fromRaw());
      this.$el.addClass('col-' + this.col.get('key'));
      return this;
    },

    toRaw: function() {
      var t = this.$el.text();
      return t;
    },

    fromRaw: function() {
      var v = this.model.get(this.col.get('key'));
      return v;
    },

    onClick: function() {
      this.col.trigger('cell:edit', this.$el, this.model);
    }
  });

  var HeaderCell = BBLib.HeaderCell = Backbone.View.extend({
    tagName: 'td',

    className: 'bbtable-header-cell',

    sortingTemplate: _.template("<div class='sorting sorting-<%= sortDir %> pull-right'>" 
      + "<i class='<%= iconClass %>'></i></div>"),

    events: {
      'click .sorting': 'sort'
    },

    initialize: function(options) {
      _.bindAll(this, 'render', '_getSortingIconClass');
      this.collection = options.collection;

      if (this.model.get('sortable')) {
        this.listenTo(this.collection.sortingModel, 'change', this.renderSortingEl);
      }
    },

    render: function() {
      this.$el.html(this.model.get('label') || this.model.get('key'));
      this.$el.addClass('col-' + this.model.get('key'));

      if (this.model.get('sortable')) {
        this.$el.addClass('sortable');
        this.renderSortingEl()
      }

      return this;
    },

    renderSortingEl: function() {
      var sorting = this.collection.sortingModel,
          sortKey = sorting.get('sortKey'),
          key = this.model.get('key'),
          dir = sortKey === key ? sorting.get('sortDir') : null;

      this.$el.find('div.sorting').remove();
      iconClass = this._getSortingIconClass(dir);
      this.$el.append(this.sortingTemplate({sortDir: sorting.getSortDirAsString(), iconClass: iconClass}));
    },

    sort: function() {
      var sorting = this.collection.sortingModel,
          sortKey = sorting.get('sortKey'),
          key = this.model.get('key'),
          sortDir = sorting.get('sortDir');

      if (sortKey === key) {
        dir = sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        dir = 'asc';
      }

      sorting.set({
        'sortKey': this.model.get('key'),
        'sortDir': dir
      });
    },

    _getSortingIconClass: function(sortDir) {
      switch (sortDir) {
          case 'asc': return 'icon-chevron-up';
          case 'desc': return 'icon-chevron-down';
          default: return 'icon-unsorted';
      }
    }
  });

  var TableHeader = BBLib.TableHeader = Backbone.View.extend({
    tagName: 'div',

    template: _.template("<table class='table'></table>"),

    className: 'bbtable-header',

    initialize: function(options) {
      _.bindAll(this, 'render');
      
      this.cols = options.cols;
      this.headerCellClass = options.headerCellClass || HeaderCell;
    },

    render: function() {
      this.$el.empty();
      this.$el.html(this.template());
      this.$table = this.$('table');
      var row = $('<tr></tr>');

      _.each(this.cols.models, function(col) {
        var CellClass= col.headerCell || HeaderCell;
        var cell = new CellClass({model: col, collection: this.model});
        row.append(cell.render().el);
      }, this);
      this.$table.append(row);

      return this;
    }
  });

  var Table = BBLib.Table = Backbone.View.extend({
    tagName: 'div',

    className: 'bbtable',

    initialize: function(options) {
      requiredOptions(options, ['cols']);

      this.editable = options.editable || false;
      this.headClass = options.headClass || TableHeader;
      this.bodyClass = options.bodyClass || TableBody;
      this.head = new this.headClass(options);
      this.body= new this.bodyClass(options);
    },

    render: function() {
      this.$el.empty();
      this.$el.append(this.head.render().el);
      this.$el.append(this.body.render().el);
      return this;
    }
  });

  var TableBody = BBLib.TableBody = Backbone.View.extend({
    tagName: 'div',

    className: 'bbtable-body',

    template: _.template("<table class='table table-striped'></table>"),

    initialize: function(options) {
      requiredOptions(options, ['cols']);
      _.bindAll(this, 'render');

      this.model.on('reset', this.render);
      this.rowClass = options.rowClass || TableRow;
      this.cols = options.cols;
      this.rows = [];
    },

    render: function() {
      this.$el.empty();
      this.$el.html(this.template());
      this.$table = this.$('table');
      this.rows = [];

      _.each(this.model.models, function(m) {
        var row = new this.rowClass({model: m, cols: this.cols});
        this.rows.push(row);
        this.$table.append(row.render().el);
      }, this);
      
      return this;
    }
  });

  var TableRow = BBLib.TableRow = Backbone.View.extend({
    tagName: 'tr',

    className: 'bbtable-row',

    initialize: function(options) {
      requiredOptions(options, ['cols']);
      this.cols = options.cols;
      _.bindAll(this, 'render');

      this.listenTo(this.model, 'change', this.render);
    },

    render: function() {
      this.$el.empty();
      _.each(this.cols.models, function(col){
        var CellClass= col.cell || Cell;
        var v = new CellClass({model: this.model, col: col});
        this.$el.append(v.render().el);
      }, this);
      return this;
    }
  });

  var CellEditor = BBLib.CellEditor = Backbone.View.extend({
    tagName: 'div',
    
    className: 'cell-editor'
  });
  
  var InputCellEditor = BBLib.InputCellEditor = CellEditor.extend({
    events: {
      'blur input': 'blur',
      'keypress input': 'keypress'
    },
    
    template: _.template("<input type='text' value=<%= value %>>"),
    
    initialize: function(options) {
      this.model = options.model;
      this.cell = options.cell;
      this.col = options.col;
      
      this.render();
      $(document.body).append(this.el);
      this.$input = this.$el.find('input');
      this.show();
    },
    
    render: function() {
      this.$el.append(this.template({value: this.model.get(this.col.get('key'))}));
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
      this.model.set(this.col.get('key'), this.$input.val());
    },
    
    blur: function() {
      this.updateModel();
      this.remove();
    }
  });

  $.fn.bbtable = function(options) {
    requiredOptions(options, ['url', 'columns'])

    options = $.extend({
      modelClass: Backbone.Model,
      pagingMode: 'client', // possible value 'client' or 'server'
      pageSize: 100,
      paginatorContainer: null,
      paginatorCls: PageSelectorView,
    }, options);

    return this.each(function() {
      var $this = $(this);

      var paginationModel = new BBLib.PaginationModel({
        pageSize: options.pageSize || 100
      });

      var cols = new Columns(options.columns),
          pageableCls = options.pagingMode === 'client' ? ClientSidePageable : ServerSidePageable,
          Collection = pageableCls.extend({url: options.url, model: options.modelClass}),
          collection = new Collection({paginationModel: paginationModel}),
          table = new Table({cols: cols, model: collection}),
          paginator = new options.paginatorCls({model: paginationModel});

      $this.append(table.render().el);

      if (options.paginatorContainer) {
        $(options.paginatorContainer).append(paginator.render().el);
      } else {
        $(this).append(paginator.render().el);
      }

      $this.data({
        paginationModel: paginationModel,
        table: table,
        collection: collection
      });

      collection.fetch();
    });
  }
}).call(this, jQuery);

