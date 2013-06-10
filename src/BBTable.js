;/**
  * @author billg(viruschidai@gmail.com)
  * This is a backbone.js based table widget.
  */
(function() {
  var BBLib;

  if (!this.BBLib) {
    BBLib = this.BBLib = {}
    BBLib.VERSION = "0.1.0";
  } else {
    BBLib = this.BBLib;
  }

  var requiredOptions = function(options, required) {
    for (var x in required) {
      var option = required[x];
      if (!(option in options)) {
        throw new Error("option." + option + " is required!");
      }
    }
  };

  var Column = BBLib.Column = Backbone.Model.extend({
    defaults: {
      key: undefined,
      label: undefined,
      sortable: true,
      editable: true,
      renderable: true,
      cell: Cell,
      cellEditor: undefined
    }
  });

  var Columns = BBLib.Columns = Backbone.Collection.extend({
    model: Column
  });

  var Cell = BBLib.Cell = Backbone.View.extend({
    tagName: "td",

    className: "bbtable-cell",

    initialize: function(options){
      requiredOptions(options, ['col']);
      this.col = options.col;
    },

    render: function() {
      this.$el.html(this.fromRaw());
      this.$el.addClass("col-" + this.col.get("key"));
      return this;
    },

    toRaw: function() {
      var t = this.$el.text();
      return t;
    },

    fromRaw: function() {
      var v = this.model.get(this.col.get('key'));
      return v;
    }
  });

  var HeaderCell = BBLib.HeaderCell = Backbone.View.extend({
    tagName: "td",

    className: "bbtable-header-cell",

    render: function() {
      this.$el.html(this.model.get('label') || this.model.get('key'));
      this.$el.addClass("col-" + this.model.get("key"));
      return this;
    }
  });

  var TableHeader = BBLib.TableHeader = Backbone.View.extend({
    tagName: "div",
    template: _.template("<table class='table'></table>"),
    className: "bbtable-header",
    initialize: function(options) {
      this.cols = options.cols;
      this.headerCellClass = options.headerCellClass || HeaderCell;
    },

    render: function() {
      this.$el.empty();
      this.$el.html(this.template());
      this.$table = this.$('table');
      var row = $("<tr></tr>");
      _.each(this.cols.models, function(col) {
        var CellClass= col.headerCell || HeaderCell;
        var cell = new CellClass({model: col});
        row.append(cell.render().el);
      }, this);
      this.$table.append(row);
      return this;
    }
  });

  var Table = BBLib.Table = Backbone.View.extend({
    tagName: "div",
    
    className: "bbtable",

    initialize: function(options) {
      requiredOptions(options, ['cols']);

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
    tagName: "div",

    className: "bbtable-body",

    template: _.template("<table class='table'></table>"),

    initialize: function(options) {
      requiredOptions(options, ['cols']);
      _.bindAll(this, 'render');
      this.model.on("reset", this.render);
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
    tagName: "tr",

    className: "bbtable-row",

    initialize: function(options) {
      requiredOptions(options, ['cols']);
      this.cols = options.cols;
    },
    
    render: function() {
      _.each(this.cols.models, function(col){
        var CellClass= col.cell || Cell;
        var v = new CellClass({model: this.model, col: col});
        this.$el.append(v.render().el);
      }, this);
      return this;
    }
  })
}).call(this);

