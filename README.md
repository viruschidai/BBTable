# BBTable.js

BBTable.js is a backbone.js based table widget. It is currently under active development. 

## Features

1. Support sorting 
2. Support pagination (Currently only support client side pagination. Will soon add support for server side pagination)
3. Support editing (Currently only have one input cell editor. But it is really easy to add your own editor)

## Requires

1. jQuery
2. Undersocre.js
3. Backbone.js
4. Twitter Bootstrap CSS

## Example

```javascript
var CityModel = Backbone.Model.extend({
	idAttribute: "Zipcode"
});

var ExampleCollection = BackTable.PageableCollection.extend({url: '/collection/', model: CityModel});

var collection = new ExampleCollection({});

var columns = [
{
  'key': 'Zipcode',
  'label': 'Zipcode'
},
{
  'key': 'County',
  'label': 'County'
},
{
  'key': 'State',
  'label': 'State'
},
{
  'key': 'City',
  'label': 'City'
},
{
  'key': 'Longitude',
  'label': 'Longitude'
},
{
  'key': 'Latitude',
  'label': 'Latitude'
}
];

var paginatorTop = new BackTable.PaginatorView({model: collection.paginationModel});
var paginatorBottom = new BackTable.PaginatorView({model: collection.paginationModel});

$('#table-container').append(paginatorTop.render().el);
	
$('#table-container').append(
  new BackTable.Table({collection: collection, columns: columns}).render().el
);

$('#table-container').append(paginatorBottom.render().el);
	
collection.fetchCurrentPage();
```
## Live example
Have a look at [Pagination table](http://bbtable.aws.af.cm/).

## License
Copyright (c) 2013 Bill Gao  
Source code licensed under the [MIT license](LICENSE-MIT "MIT License").
