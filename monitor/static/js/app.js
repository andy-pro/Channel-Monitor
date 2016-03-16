/*
 * client side
 * Channel Monitor System
 * UkSATSE
 * Telecommunication Service
 *
 * Backbone
 * Underscore
 * <a href="xyz"> SPA type link
 * <a data-bypass href="xyz"> regular link
 *
 * andy-pro 2016
 */

$(function () {    
        
    var app = {
      root: "monitor",
      name: "Channel Monitor",
      el: $("#content"),
      
      initialize: function() {
        var root = this.root;
 
        // prepare routes hash
        var r = {};
        [ ['', 'monitor'], 
          ['/', 'monitor'],
          ['/index', 'monitor'],
          ['/index.html', 'monitor'],
          ['/config', 'config'],
          ['/try_api', 'try_api']
        ].forEach(function(i) { r[root+i[0]] = i[1]; });        
        
        this.router = new Router({routes: r});
        
        // this.monitor = new Monitor();
                
        // views hash
        this.views = {
          monitor: new MonitorView(),
          config:  new ConfigView(),
          try_api:  new TryAPIView()
        }
       
        // enable history.back() when 'ESC' key pressed
        document.onkeydown = function(e) {
          if (e.keyCode == 27) {  // escape key code check
            history.back(); 
            return false;
          }
	      }
        
        // links setup 
        $("body").on("click","a:not(a[data-bypass])",function(e){
          e.preventDefault();
          var href = $(this).attr("href");
          app.location = href;
          Backbone.history.navigate(href, {trigger: true});
        });
      }

    }
    
    var Channel = Backbone.Model.extend({});

    var Monitor = Backbone.Collection.extend({
      model: Channel,
      url: '/monitor/getnames'
      // initialize: function () {
        // this.fetch();
      // }
    });
    
    //=================================================
    var ChannelView = Backbone.View.extend({
      tagName: "tr",
      template: _.template($("#ChannelTmpl").html()),        
      render: function(idx) {
        this.model.attributes.idx = idx;
        this.$el.html(this.template(this.model.toJSON()));
        // console.log('model:', this.model);
        return this;
      }
    });    
    
    //=================================================
    
    var MonitorView = Backbone.View.extend({      
      tagName: 'tbody',
      template: _.template($('#MonitorTmpl').html()),
      initialize: function () {
        this.collection = new Monitor();
        // this.collection.on('reset', this.render, this);
        // this.collection.on('reset', _.bind(this.render, this));
      },
      
      start: function() {
        this.collection.fetch();
        // var self = this;
        // this.collection.fetch({ 
          // success: function () { 
            // console.log("collection fetched"); 
            // self.render();
          // } 
        // });
        this.render();
      },
      
      render: function() {
        console.log('render table');
        this.collection.each(function (channel, idx) {
          var channelView = new ChannelView({model: channel});
        console.log('render', idx, channelView);
          this.$el.append(channelView.render(idx + 1).el);          
        }, this);
        app.el.html(this.template({tbody: this.el.innerHTML}));
      }     
      
    });      
       
    //=================================================
    
    var ConfigView = Backbone.View.extend({      
      el: $("#content"),      
      html: '', 
      template: '',
      // template: _.template($('#thumbTmpl').html()),
      initialize: function () {

      },
      render: function () {     
        this.$el.html('config');
        // this.$el.html(this.html);
        // return this;
      },
    });  

    //=================================================
    
    var TryAPIView = Backbone.View.extend({      
      el: app.el,      
      html: _.template($('#TryAPITmpl').html())(),      
      render: function() {
        this.$el.html(this.html);
        return this;
      },
      events: {
        "submit form#form-api": "callAPI",
        "click #clear": 'clearArea'
      },
      clearArea: function() {
        console.log('textarea cleared');
        $('#textarea').text('');
        return false;
      },
      callAPI: function() {
        var h = '/monitor/query',
            q = {query: $('#command').val()},
            area = $('#textarea');
        $.get(h, q).always(function(data, status, xhr) {
		      if (status=='success') {
            // console.log(data, status, xhr);
            // res.text(res.text() + xhr.responseText + '\n');
            area.text(area.text() + data.response + '\n');
          } else console.log(status);
        });
        return false;
      }
      
    }); 
                
    //=================================================
    var Router = Backbone.Router.extend({
      
      monitor: function() {
        // this.monitor = new Monitor();
        // app.views.monitor.render();
        app.views.monitor.start();
      },
      
      config: function() {
        app.views.config.render();
        // this.get_ajax('cat', cat);
      },  
      
      try_api: function() {
        app.views.try_api.render();
        //this.get_ajax('prj', cl, prj);
      },     
      
      // get_ajax: function(view, arg0, arg1) {
        // var href = '/' + Backbone.history.getFragment();
        // console.log('route: ', view, ' href: ', href); 
        // $.get(href).always(function(data, status) {
		  // if (status=='success') app.views[view].render(data, arg0, arg1);
          // else console.log(status);
        // });
      // }
            
    });    
    
    //=================================================
    
    app.initialize();
    
    Backbone.history.start({
        root: '/',
        pushState: true
    });
 
}); 
