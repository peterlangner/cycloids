/*==============================================================
  Filename: Cango3D3v19.js
  Rev: 3
  By: A.R.Collins
  Description: A basic 3D graphics interface for the canvas
  element using Right Handed coordinate system.
  License: Released into the public domain latest version at
  <http://www.arc.id.au/Canvas3DGraphics.html>
  Report bugs to tony at arc.id.au

  Date   |Description                                       |By
  --------------------------------------------------------------
  05May13 First beta after major re-write: soft transforms
          now applied by Group3D method not by render3D.
          Transforms now use grpTfm, ofsTfm, netTfm          ARC
  06May13 bugfix: order of transform multiply reversed
          Make matrixMultiply and transform point globals
          Use RequestAnimationFrame                          ARC
  07May13 Give Group3Ds and Obj3Ds a render method
          Use rAF to limit code in event handlers
          bugfix: group nettFm mat multiply in wrong order
          Only propagate transform updates when rendering    ARC
  08May13 Changed labelShape3D to labelShape                 ARC
  09May13 Dont allow clone to clone cgo property
          Allow only Group3Ds or Obj3Ds to join a Group3D.
          Removed clearCanvas color setting ability (not
          compatable with the new render method). Set
          canvas backgrounColor with setPropertyDefault.
          Added noclear parameter to render3D
          Added noclear, noRaf options to obj and grp render ARC
  10May13 bugfix: non existant cgo used in compileText3D
          bugfix: bad vectors for calcNormal if cmd = 'Q'    ARC
  11May13 Removed unsed dupCtx
          renamed jsonToDrawCnds3D to _cgo3DtoDrawCmd3D
          Gave objectOfRevolution a 'straight' side option   ARC
  12May13 Replace objOfRev 'radius' with xOfs (opp sign)     ARC
  13May13 Change the depth sort algorithm, sort Group3Ds
          by group centroid.tz, then sort Obj3Ds children.
          If objectOfRevolution has flat top or bottom
          replace multi-segments with single disc
          Patched JSONtoObj3D Group3D decode to be robust
          bugfix: dwgOrg not getting transformed - re-write
          dump Obj3D.dwgOrg and dwgOrgPx, leave in dragNdrop
          bugfix: calcNormal and calcIncAngle could /zero    ARC
  16May13 renamed undocumented methods calcShapeShade,
          getCursorPos and render3D to _calcShapeShade,
          _getCursorPos and _render3D                        ARC
  ==============================================================*/

  var _resized = new Array();   // keep track of which canvases are initialised

  var shapeDefs = {'circle':["M", -0.5, 0, 0, "C", -0.5, -0.27614, 0, -0.27614, -0.5, 0, 0, -0.5, 0,
                                              "C", 0.27614, -0.5, 0, 0.5, -0.27614, 0, 0.5, 0, 0,
                                              "C", 0.5, 0.27614, 0, 0.27614, 0.5, 0, 0, 0.5, 0,
                                              "C", -0.27614, 0.5, 0, -0.5, 0.27614, 0, -0.5, 0, 0],
                   'square':['M', 0.5, -0.5, 0, 'l', 0, 1, 0, -1, 0, 0, 0, -1, 0, 'z'],
                   'triangle':['M', 0.5, -0.289, 0, 'l', -0.5, 0.866, 0, -0.5, -0.866, 0, 'z'],
                   'cross':['M', -0.5, 0, 0, 'l', 1, 0, 0, 'M', 0, -0.5, 0, 'l', 0, 1, 0],
                   'ex':['M', -0.3535,-0.3535, 0, 'L',0.3535,0.3535, 0, 'M',-0.3535,0.3535, 0, 'L',0.3535,-0.3535, 0]};

  function Cango3D(canvasId)
  {
    this.cId = canvasId;
    this.cnvs = document.getElementById(canvasId);
    this.rawWidth = this.cnvs.offsetWidth;
    this.rawHeight = this.cnvs.offsetHeight;
    this.aRatio = this.rawWidth/this.rawHeight;

    if (!(this.cId in _resized))
    {
      /* Note: rawWidth and rawHeight are floats, assignment to ints will truncate */
      this.cnvs.setAttribute('width', this.rawWidth);   // reset the number of graphics pixels
      this.cnvs.setAttribute('height', this.rawHeight); // use this instead of style
      /* create a reference in gloable array to show this canvas has been resized,
         to prevent repeated resize (which would erase previous drawing as well as waste time). */
      _resized[this.cId]= true;
    }

    this.ctx = this.cnvs.getContext('2d');
    this.ctx.save();

    this.vpW = this.rawWidth;         // vp width in pixels (default to full canvas size)
    this.vpH = this.rawHeight;        // vp height in pixels
    this.vpLLx = 0;                   // vp lower left from canvas left in pixels
    this.vpLLy = this.rawHeight;      // vp lower left from canvas top
    this.xscl = this.rawWidth/100;    // world x axis scale factor, default: canvas width = 100 units
    this.yscl = -this.rawWidth/100;   // world y axis scale factor, default +ve up and
                                      // canvas height =100*aspect ratio (square pixels)
    this.xoffset = 0;                 // world x origin offset from viewport left in pixels
    this.yoffset = 0;                 // world y origin offset from viewport bottom in pixels
                                      // *** to move to world coord x ***
                                      // 1. from pixel x origin (canvas left) add vpLLx (gets to viewport left)
                                      // 2. add xoffset to get to pixel location of world x origin
                                      // 3. add x*xscl pixels to get to world x location.
                                      // ie x (in world coords) ==> vpLLx + xoffset + x*xscl (pixels)
                                      //    y (in world coords) ==> vpLLy + yoffset + y*xscl (pixels)

    this.penCol = new RGBAColor("rgb(0,0,0)");
    this.penWid = 1;            // pixels
    this.lineCap = "butt";
    this.paintCol = new RGBAColor("rgb(128,128,128)");
    this.fontSize = 10;         // 10pt

    this.viewpointDistance = 1000;
    this.lightSource = {x:0, y:100, z:500};     // world coords
    this.plotNormals = false;   // diagnostic, if true green (toward) or red (away) normals are drawn

    this.reBusy = false;        // flag to limit render calls from event handlers

    this.draggable = [];        // array of Obj2Ds that are draggable
    this.currDrag = null;       // Obj2D that is being dragged

    var savThis = this;

    this.cnvs.onmousedown = function(event)
    {
      var event = event || window.event;
      var crsPos = savThis._getCursorPos(event);

      function hitTest(pathObj)
      {
        // create the path (don't stroke it - noone will see) to test for hit
        var worldCoords = [];
        savThis.ctx.beginPath();
        for (var i=0; i<pathObj.pxOutline.length; i++)
        {
          savThis.ctx[pathObj.pxOutline[i].drawFn].apply(savThis.ctx, pathObj.pxOutline[i].parms);
        }
/*
        // for diagnostics on hit region, uncomment
        savThis.ctx.strokeStyle = 'red';
        savThis.ctx.lineWidth = 4;
        savThis.ctx.stroke();
*/
        return savThis.ctx.isPointInPath(crsPos.x, crsPos.y);
      }
      // run through all the registered objects and test if cursor pos is in their path
      for (var i = 0; i<savThis.draggable.length; i++)
      {
        if (hitTest(savThis.draggable[i]))
        {
          savThis.currDrag = savThis.draggable[i];     // assign Obj2D that is being dragged
          savThis.currDrag.dragNdrop.grab(event);
          break;
        }
      }
    }
  }

  Cango3D.prototype.toPixelCoords3D = function(x, y, z)
  {
    // transform x,y,z in world coords to canvas pixel coords (top left is 0,0,0 y axis +ve down)
    var xPx = this.vpLLx+this.xoffset+x*this.xscl;
    var yPx = this.vpLLy+this.yoffset+y*this.yscl;
    var zPx = z*this.xscl;

    return {x: xPx, y: yPx, z:zPx};
  }

  Cango3D.prototype.toWorldCoords3D = function(xPx, yPx, zPx)
  {
    // transform xPx,yPx,zPx in raw canvas pixels to world coords (lower left is 0,0 +ve up)
    var xW = (xPx - this.vpLLx - this.xoffset)/this.xscl;
    var yW = (yPx - this.vpLLy - this.yoffset)/this.yscl;
    var zW = zPx/this.xscl;

    return {x: xW, y: yW, z:zW};
  }

  Cango3D.prototype._getCursorPos = function(e)
  {
    // pass in any mouse event, returns the position of the cursor in raw pixel coords
    var e = e||window.event;
    var rect = this.cnvs.getBoundingClientRect();

    return {x: e.clientX - rect.left, y: e.clientY - rect.top};
  }

  Cango3D.prototype.clearCanvas = function()
  {
    this.ctx.clearRect(0, 0, this.rawWidth, this.rawHeight);
    // all drawing erased, but graphics contexts remain intact
    // clear the draggable array, draggables put back when rendered
    this.draggable = [];
    this.currDrag = null;
  }

  Cango3D.prototype.setWorldCoords3D = function(leftX, lowerY, spanX)
  {
    if (spanX >0)
    {
      this.xscl = this.vpW/spanX;
      this.yscl = -this.xscl;
      this.xoffset = -leftX*this.xscl;
      this.yoffset = -lowerY*this.yscl;
    }
    else
    {
      this.xscl = this.rawWidth/100;    // makes xaxis = 100 native units
      this.yscl = -this.rawWidth/100;   // makes yaxis = 100*aspect ratio ie. square pixels
      this.xoffset = 0;
      this.yoffset = 0;
    }
  }

  Cango3D.prototype.setPropertyDefault = function(propertyName, value)
  {
    if ((typeof propertyName != "string")||(typeof value == "undefined")||(value == null))
      return;

    switch (propertyName.toLowerCase())
    {
      case "backgroundcolor":
        var newCol = new RGBAColor(value);
        if (newCol.ok)
          this.cnvs.style.backgroundColor = newCol.toRGBA();
        break;
      case "fillcolor":
        var newCol = new RGBAColor(value);
        if (newCol.ok)
          this.paintCol = newCol;
        break;
      case "strokecolor":
        var newCol = new RGBAColor(value);
        if (newCol.ok)
          this.penCol = newCol;
        break;
      case "strokewidth":
        this.penWid = value;
        this.ctx.lineWidth = this.penWid;
        break;
      case "linecap":
        if (typeof value != "string")
          return;
        if ((value == "butt")||(value =="round")||(value == "square"))
          this.lineCap = value;
        this.ctx.lineCap = this.lineCap;
        break;
      case "fontsize":
        this.fontSize = value;
        break;
      default:
        return;
    }
  }

  Cango3D.prototype.setViewpointDistance = function(d)    // d in world coords
  {
    if (d > 0)
      this.viewpointDistance = d;
  }

  Cango3D.prototype.setLightSource = function(x, y, z)    // x, y, z in world coords
  {
    if ((x != undefined)&&(y != undefined)&&(z != undefined))
    {
      this.lightSource.x = x;
      this.lightSource.y = y;
      this.lightSource.z = z;
    }
  }

  // this method allows the Object Group3D to be passed the Cango3D environment
  Cango3D.prototype.createGroup3D = function()
  {
    var grp = new Group3D(this)
    grp.addObj.apply(grp, arguments);

    return grp;
  }

  Cango3D.prototype.compilePath3D = function(path, color, lineWidth, scl, drag)
  {
    // this expects an array of Cgo3D Path syntax letters and numbers
    // which are converted to segs (segment arrays)
    // segs = [ ['M',x,y,z], ['L',x,y,z,x,y,z],['C',x,y,z,x,y,z ..], [], []... ];
    // which are then compiled to canvas drawCmd objects ready to render
    if (!(path instanceof Array))
      return;

    var segs = [];
    var i, j;
    for(j=0, i=1; i<path.length; i++)
    {
      if (typeof path[i] == 'string')
      {
        segs.push(path.slice(j,i));
        j = i;
      }
    }
    segs.push(path.slice(j,i));    // push the last command out
    // now send these off to the svg segs-to-canvas DrawCmd processor
    // now send these off to the svg segs-to-canvas DrawCmd processor
    var scale = 1;
    if ((typeof scl != "undefined")&&(scl>0))
    {
      scale *= scl;
    }
    var xOfs = 0;                 // move the shape reference point
    var yOfs = 0;
    var zOfs = 0;

    var commands = this._cgo3DtoDrawCmd3D(segs, xOfs, yOfs, zOfs, scale);

    var obj = new Obj3D(this, commands, "PATH", color, null, drag);
    obj.strokeWidth = lineWidth || this.penWid;

    return obj;   // object of type Obj3D
  }

  Cango3D.prototype.compileShape3D = function(path, fillColor, bkCol, scl, drag)
  {
    // this expects an array of Cgo3D Path syntax letters and numbers
    // which are converted to segs (segment arrays)
    // segs = [ ['M',x,y,z], ['L',x,y,z,x,y,z],['C',x,y,z,x,y,z ..], [], []... ];
    // which are then compiled to canvas drawCmd objects ready to render
    if (!(path instanceof Array))
      return;

    var segs = [];
    var i, j;
    for(j=0, i=1; i<path.length; i++)
    {
      if (typeof path[i] == 'string')
      {
        segs.push(path.slice(j,i));
        j = i;
      }
    }
    segs.push(path.slice(j,i));    // push the last command out
    // now send these off to the svg segs-to-canvas DrawCmd processor
    var scale = 1;
    if ((typeof scl != "undefined")&&(scl>0))
    {
      scale *= scl;
    }
    var xOfs = 0;                 // move the shape reference point
    var yOfs = 0;
    var zOfs = 0;

    var commands = this._cgo3DtoDrawCmd3D(segs, xOfs, yOfs, zOfs, scale);

    var obj = new Obj3D(this, commands, "SHAPE", fillColor, bkCol, drag);

    return obj;   // object of type Obj3D
  }

  Cango3D.prototype.compileText3D = function(str, color, ptSize, fontWt, lorigin, drag)
  {
    if (typeof str != 'string')
      return;

    var lorg = lorigin || 1;
    var size = ptSize || this.fontSize;
    size /= this.xscl;    // independent of world coord scaling, set size by point size
    var mag = size/25;    // size/25 is worlds coords scaled to stored font size

    var cmdObj;
    var commands = [];
    var cPts;
    var ep;
    var xLofs = 0;
    var yLofs = 0;  /* label origin offsets */

    var wid = CanvasTextFunctions.measure(0, size, str);
    var hgt = 0.84*size;
    /* Note: char cell is 33 pixels high, char size is 21 pixels (0 to 21), decenders go to -7 to 21.
       passing 'size' to text function scales char height by size/25.
       So reference height for vertically alignment is charHeight = 21/25 (=0.84) of the fontSize. */
    var wid2 = wid/2;
    var hgt2 = hgt/2;
    var lorgWC = [0, [0, hgt],  [wid2, hgt],  [wid, hgt],
                     [0, hgt2], [wid2, hgt2], [wid, hgt2],
                     [0, 0],    [wid2, 0],    [wid, 0]    ];

    var dx = -lorgWC[lorg][0];
    var dy = -lorgWC[lorg][1];
    for (var i = 0; i < str.length; i++)
    {
      var c = CanvasTextFunctions.letter(str.charAt(i));
      if (!c)
        continue;
      var penUp = 1;
      for (var j = 0; j < c.points.length; j++)
      {
        var a = c.points[j];
        if ((a[0] == -1) && (a[1] == -1))
        {
          penUp = 1;
          continue;
        }
        if (penUp == 1)
        {
          cPts = [];
          ep = new Point(dx + a[0]*mag, dy + a[1]*mag, 0);
          cmdObj = new DrawCmd3D('moveTo', cPts, ep);
          commands.push(cmdObj);
          penUp = 0;
        } else {
          cPts = [];
          ep = new Point(dx + a[0]*mag, dy + a[1]*mag, 0);
          cmdObj = new DrawCmd3D('lineTo', cPts, ep); // any coord pair after first move is regarded as line
          commands.push(cmdObj);
        }
      }
      dx += c.width*mag;
    }

    var obj = new Obj3D(this, commands, "TEXT", color, null, drag);

    var weight = 400;   // default = 400
    if (typeof fontWt != 'undefined')
      weight = fontWt;           // 'bold' etc
    else if (isNumber(fontWt) && (fontWt > 99) && (fontWt < 901))
      weight = fontWt;           // 100 .. 900
    var lineWidth = 0.08*size;  // 'normal=400' (see CanvasTextFuctions.draw)
    obj.strokeWidth = lineWidth*weight/400;    // normal weight stroke width is saved
    // now calc the 4 corners of the bounding box
    obj.ul = new Point(-dx, -dy, 0);
    obj.ur = new Point(-dx+wid, -dy, 0);
    obj.ll = new Point(-dx, -dy-hgt, 0);
    obj.lr = new Point(-dx+wid, -dy-hgt, 0);
    // calc better centroid and normal
    obj.centroid.x = obj.ul.x + wid/2;
    obj.centroid.y = obj.ul.y - hgt/2;
    obj.centroid.z = 0;
    obj.normal.x = obj.centroid.x;
    obj.normal.y = obj.centroid.y;
    obj.normal.z = 10/this.xscl;

    return obj;
  }

  Cango3D.prototype.labelShape = function(obj, str, x, y, ptSize, fontWt, lorigin, color)
  {
    if ((typeof str != 'string')||(obj.type != "SHAPE"))
      return null;

    if (str.length == 0)
    {
      // remove label any labels from the shape
      obj.textCmds = [];
      obj.lineWidth = 1;
    }
    obj.textCmds = this._compileText(str, x, y, ptSize, lorigin);  // replace existing label (if any)
    var newCol = new RGBAColor(color);
    if (newCol.ok)
      obj.strokeColor = newCol;
    else
      obj.strokeColor = this.penCol;
    var size = ptSize || this.fontSize;
    var weight = 400;   // default = 400
    if (typeof fontWt != 'undefined')
      weight = fontWt;           // 'bold' etc
    else if (isNumber(fontWt) && (fontWt > 99) && (fontWt < 901))
      weight = fontWt;           // 100 .. 900
    var lineWidth = 0.08*size;  // 'normal=400' (see CanvasTextFuctions.draw)
    obj.strokeWidth = lineWidth*weight/400;    // normal weight stroke width is saved
  }

  Cango3D.prototype.appendLabel = function(obj, str, x, y, ptSize, lorigin)
  {
    if ((typeof str != 'string')||!(str.length)||(obj.type != "SHAPE"))
      return null;

    var commands = this._compileText(str, x, y, ptSize, lorigin);

    obj.textCmds = obj.textCmds.concat(commands);  // add to existing label (if any)
  }

  Cango3D.prototype._compileText = function(str, x, y, ptSize, lorigin)
  {
    var lorg = lorigin || 1;
    var size = ptSize || this.fontSize;
    size /= this.xscl;    // independent of world coord scaling, set size by point size
    var mag = size/25;    // size/25 is worlds coords scaled to stored font size

    var cmdObj;
    var commands = [];
    var cPts;
    var ep;
    var xLofs = 0;
    var yLofs = 0;  /* label origin offsets */

    var wid = CanvasTextFunctions.measure(0, size, str);
    var hgt = 0.84*size;
    /* Note: char cell is 33 pixels high, char size is 21 pixels (0 to 21), decenders go to -7 to 21.
       passing 'size' to text function scales char height by size/25.
       So reference height for vertically alignment is charHeight = 21/25 (=0.84) of the fontSize. */
    var wid2 = wid/2;
    var hgt2 = hgt/2;
    var lorgWC = [0, [0, hgt],  [wid2, hgt],  [wid, hgt],
                     [0, hgt2], [wid2, hgt2], [wid, hgt2],
                     [0, 0],    [wid2, 0],    [wid, 0]];
    var dx = x-lorgWC[lorg][0];
    var dy = y-lorgWC[lorg][1];

    for (var i = 0; i < str.length; i++)
    {
      var c = CanvasTextFunctions.letter(str.charAt(i));
      if (!c)
        continue;

      var penUp = true;
      for (var j = 0; j < c.points.length; j++)
      {
        var a = c.points[j];
        if ((a[0] == -1) && (a[1] == -1))
        {
          penUp = true;
          continue;
        }
        if (penUp)
        {
          cPts = [];
          ep = new Point(dx + a[0]*mag, dy + a[1]*mag, 0);
          cmdObj = new DrawCmd3D('moveTo', cPts, ep);
          commands.push(cmdObj);
          penUp = false;
        }
        else
        {
          cPts = [];
          ep = new Point(dx + a[0]*mag, dy + a[1]*mag, 0);
          cmdObj = new DrawCmd3D('lineTo', cPts, ep); // any coord pair after first move is a line
          commands.push(cmdObj);
        }
      }
      dx += c.width*mag;
    }

    return commands;
  }

  /*=========================================================
   * JSONtoObj3D
   * Convert the JS object parsed from JSON string into
   * an Obj3D or Group3D of Obj3D.
   * usage:
   * (load a file as a string into 'var jsonStr')
   * var jsonData = JSON.parse(jsonStr);
   * obj = cgo.JSONtoObj3D(jsonData);
   *---------------------------------------------------------
   */
  Cango3D.prototype.JSONtoObj3D = function(jsonData)
  {
    var savThis = this;

    function makeObj(data)
    {
      var obj;
      var fillCol = data.fillColor || null;
      var strokeCol = data.strokeColor || null;
      var backCol = data.backColor || null;
      var textCol = data.strokeColor || 'black';
      var textWid = data.strokeWidth || 1;

      if (data.type == "GROUP")
      {
        obj = savThis.createGroup3D();
      }
      else if (data.type == "PATH")
      {
        obj = savThis.compilePath3D(data.pathData, strokeCol, textWid);
      }
      else if (data.type == "SHAPE")
      {
        obj = savThis.compileShape3D(data.pathData, fillCol, backCol);
        if (data.textData != undefined)
        {
          obj.strokeColor = new RGBAColor(textCol);
          obj.strokeWidth = textWid;
          // textData is in JSON format, convert back to drawCmds
          // break into single command segments
          var segs = [];
          for(var j=0, i=1; i<data.textData.length; i++)
          {
            if (typeof data.textData[i] == 'string')
            {
              segs.push(data.textData.slice(j,i));
              j = i;
            }
          }
          segs.push(data.textData.slice(j,i));    // push the last command out
          // convert segs to canvas DrawCmd3D, save result
          obj.textCmds = savThis._cgo3DtoDrawCmd3D(segs);
        }
      }
      else if (date.type == "TEXT")
      {
        obj = savThis.compileText3D(data.pathData, strokeCol);
        obj.strokeWidth = textWid;
      }
      // save the name if any
      if (data.name)
        obj.name = data.name.slice(0);
      // if centroid and normal stored then overwrite the calculated values (handles flipNormal)
      if (data.centroid)
        obj.centroid = new Point(data.centroid[0], data.centroid[1], data.centroid[2]);
      if (data.normal)
        obj.normal = new Point(data.normal[0], data.normal[1], data.normal[2]);

      return obj;
    }

  	function iterate(task, node, grp)
  	{
  	  var item, childNode;
  		for(var x=0; x < node.children.length; x++)
  		{
  			childNode = node.children[x];
  			item = task(childNode);   // if child type is GROUP a new Group3D is returned
        grp.addObj(item);
  			if (childNode.children != undefined)
  				iterate(task, childNode, item);     // item will be a Group3D
   		}
  	}

    var output;
    var data = jsonData.ComponentData;    // componentdata is always an object
    if (data.children != undefined)     // test for Group3D
    {
      output = this.createGroup3D();
      iterate(makeObj, data, output);
    }
    else
      output = makeObj(data); // returns SHAPE or PATH data

    return output;
  }

  /*=========================================================
   * Obj3DtoJSON
   * Convert the Obj3D data to a JSON string format.
   * The JSON string ecoding can be saved to a file for
   * re-use without the neccessity of maintaing and running
   * the object creation code.
   * name and id are optional, saved with the JSON data
   * The JSON string version must still be compiled back to
   * an Obj3D for drawing but this is a simple process
   * use: obj = this.JSONtoObj3D(jsonData)
   *---------------------------------------------------------
   */
  Cango3D.prototype.Obj3DtoJSON = function(obj, nameStr)
  {
    var savThis = this;

    function rnd(val){ return Math.round(val*1000)/1000}

    function drawCmdToCgo3D(drawCmd, ary)
    {
      // push the cmd string and coords into the array
      switch (drawCmd.drawFn)
      {
        case "moveTo":
          ary.push("M");
          ary.push(rnd(drawCmd.ep.x), rnd(drawCmd.ep.y), rnd(drawCmd.ep.z));
        break
        case "lineTo":
          ary.push("L");
          ary.push(rnd(drawCmd.ep.x), rnd(drawCmd.ep.y), rnd(drawCmd.ep.z));
        break
        case "bezierCurveTo":
          ary.push("C");
          ary.push(rnd(drawCmd.cPts[0].x), rnd(drawCmd.cPts[0].y), rnd(drawCmd.cPts[0].z));
          ary.push(rnd(drawCmd.cPts[1].x), rnd(drawCmd.cPts[1].y), rnd(drawCmd.cPts[1].z));
          ary.push(rnd(drawCmd.ep.x), rnd(drawCmd.ep.y), rnd(drawCmd.ep.z));
        break
        case "quadraticCurveTo":
          ary.push("Q");
          ary.push(rnd(drawCmd.cPts[0].x), rnd(drawCmd.cPts[0].y), rnd(drawCmd.cPts[0].z));
          ary.push(rnd(drawCmd.ep.x), rnd(drawCmd.ep.y), rnd(drawCmd.ep.z));
        break
        case "closePath":
          ary.push("Z");
        break
      }
    }

    function formatObj3DData(obj)
    {
      var data = {};
      if (obj.children != undefined)     // test for Group3D
      {
        data.type = "GROUP";
        data.children = [];
        return data;
      }
      else
      {
        data.type = obj.type;           // PATH, SHAPE, TEXT
        data.fillColor = obj.fillColor.toRGBA();    // save as 'rgba(r, g, b, a)'
        data.strokeColor = obj.strokeColor.toRGBA();
        data.backColor = obj.backColor.toRGBA();
        data.strokeWidth = obj.strokeWidth;
        if (typeof obj.name != 'undefined')
          data.name = obj.name.slice(0);   // make a string not a reference
        data.pathData = [];
        for (var j=0; j<obj.drawCmds.length; j++)
        {
          drawCmdToCgo3D(obj.drawCmds[j], data.pathData);
        }
        if ((obj.type == "SHAPE")&&(obj.textCmds.length>0)) // Shape may have a label
        {
//          data.strokeWidth = obj.strokeWidth;
          data.textData = [];
          for (j=0; j<obj.textCmds.length; j++)
          {
            drawCmdToCgo3D(obj.textCmds[j], data.textData);
          }
        }
        // save centroid and normal (in case they've been flipped)
        data.centroid = [];
        data.centroid.push(rnd(obj.centroid.x), rnd(obj.centroid.y), rnd(obj.centroid.z));
        data.normal = [];
        data.normal.push(rnd(obj.normal.x), rnd(obj.normal.y), rnd(obj.normal.z));
        return data;
      }
    }

    //task:function, node:object with children
  	function iterate(task, node, outAry)
  	{
  	  var item, childNode;
  		for(var x=0; x<node.children.length; x++)
  		{
  			childNode = node.children[x];
  			item = task(childNode);   // if child is a Group3D a new array for its kids is returned
        outAry.push(item);
  			if (childNode.children != undefined)
  				iterate(task, childNode, item.children);     // item will be an array
   		}
  	}

    var output = {};
    output.type = "Component";
    output.name = nameStr || "Object1";
    output.ComponentData = {};

    if (obj.children != undefined)     // test for Group3D
    {
      output.ComponentData.type = "GROUP";
      output.ComponentData.children = [];
      iterate(formatObj3DData, obj, output.ComponentData.children);
    }
    else
    {
      output.ComponentData = formatObj3DData(obj); // returns SHAPE or PATH data
    }

    return JSON.stringify(output);
  }

  /*=============================================
   * _render3D will clear the canvas and draw
   * this Group3D or Obj3D, make sure it is only
   * called on the root object of the scene.
   * If an Obj3D is passed, update the netTfm
   * and render it.
   * If a Group3D is passed, recursively update
   * the netTfm of the group's family tree, put
   * all the tree's objects into one array,
   * sort according to z, then render all Obj3Ds.
   *--------------------------------------------*/
  Cango3D.prototype._render3D = function(obj, wireframe, noclear)  // Obj3D or Group3D, boolean, boolean
  {
    if (isArray(obj))
      return;           // only a single Obj3D or Group3D

    function updateTransforms(rootGrp)
    {
      function applyXfm(obj, grp)
      {
        if (typeof obj.children != 'undefined')    // must be a Group3D
        {
          obj.grpTfm = grp.netTfm;  // grpTfm is always netTfm of the parent Group
          // now re-calc the child group's netTfm which will be passed on to its kids
          obj.netTfm.matrix = matrixMultiply4x4(obj.ofsTfm.matrix, obj.grpTfm.matrix);
          // apply the netTfm to the grp centroid
          softTransformPoint(obj.centroid, obj.netTfm.matrix);
        }
        else
        {
          obj.grpTfm = grp.netTfm;
          obj.transform();  // re-calc the soft transformed points with new grpTfm
        }
      }
      // task:function, grp: group with children
    	function iterate(task, grp)
    	{
    		for (var x=0; x<grp.children.length; x++)
    		{
    			var childNode = grp.children[x];
     			task(childNode, grp);
    			if (childNode.children != undefined)
    				iterate(task, childNode);
    		}
    	};
      // calculate obj current net transform to propagate to the kids
      rootGrp.netTfm.matrix = matrixMultiply4x4(rootGrp.ofsTfm.matrix, rootGrp.grpTfm.matrix);
      // now propagate the current grpXfm through the tree of children
      iterate(applyXfm, rootGrp);
    }

    function obj3Dto2D(obj)
    {
      function project3D(point)
      {
        // projection is onto screen at z = 0,
        var s = savThis.viewpointDistance/(savThis.viewpointDistance-point.tz);
        // perspective projection
        point.fx = point.tx * s;
        point.fy = point.ty * s;
      }

      var j, k;
      obj.drawData = [];   // clear the drawlists
      obj.textData = [];
      project3D(obj.centroid);  // project in case they are going to be drawn for debugging
      project3D(obj.normal);
      // new transform the text bounding box
      if (obj.type == "TEXT")
      {
        project3D(obj.ul);
        project3D(obj.ur);
        project3D(obj.ll);
        project3D(obj.lr);
      }

      // make the 2D drawData parameters for each drawCmd
      for(j=0; j<obj.drawCmds.length; j++)   // step through the draw segments
      {
        obj.drawData[j] = new DrawCmd(obj.drawCmds[j].drawFn);   // this is a 2D drawCmd
        for (k=0; k<obj.drawCmds[j].cPts.length; k++)   // extract flattened 2D coords from 3D Points
        {
          project3D(obj.drawCmds[j].cPts[k]);             // apply perspective to nodes
          obj.drawData[j].parms[2*k] = obj.drawCmds[j].cPts[k].fx;
          obj.drawData[j].parms[2*k+1] = obj.drawCmds[j].cPts[k].fy;
        }
        // add the end point (check it exists since 'closePath' has no end point)
        if (obj.drawCmds[j].ep != undefined)
        {
          project3D(obj.drawCmds[j].ep);                    // apply perspective to end point
          obj.drawData[j].parms[2*k] = obj.drawCmds[j].ep.fx;
          obj.drawData[j].parms[2*k+1] = obj.drawCmds[j].ep.fy;
        }
      }

      if (obj.textCmds.length>0)  // text has been added to this Obj3D
      {
        // make the 2D textData parameters for each textCmd
        for(j=0; j<obj.textCmds.length; j++)   // step through the draw segments
        {
          obj.textData[j] = new DrawCmd(obj.textCmds[j].drawFn);   // this is a 2D drawCmd
          for (k=0; k<obj.textCmds[j].cPts.length; k++)   // extract flattened 2D coords from 3D Points
          {
            project3D(obj.textCmds[j].cPts[k]);             // apply perspective to nodes
            obj.textData[j].parms[2*k] = obj.textCmds[j].cPts[k].fx;
            obj.textData[j].parms[2*k+1] = obj.textCmds[j].cPts[k].fy;
          }
          // add the end point (check it exists since 'closePath' has no end point)
          if (obj.textCmds[j].ep != undefined)
          {
            project3D(obj.textCmds[j].ep);                  // apply perspective to end point
            obj.textData[j].parms[2*k] = obj.textCmds[j].ep.fx;
            obj.textData[j].parms[2*k+1] = obj.textCmds[j].ep.fy;
          }
        }
      }
      // the object's drawData and textData arrays now hold the 2D projection ready to be drawn
    }

    var drawableGrps = [];
  	function getDrawableGrps(grp)
  	{
  	  if (grp.drawObjs.length > 0)    // test if a drawable group
      {
        drawableGrps.push(grp);       // just push the grp into the array to be sorted and drawn
      }
      // step through the children looking for groups
  		for(var j=0; j<grp.children.length; j++)
  		{
  			var childNode = grp.children[j];
  			if ((childNode.children != undefined) && (childNode.children.length > 0))  // skip Obj3D
  				getDrawableGrps(childNode);  // check if next group has drawables
  		}
  	};


// ============ Start Here =====================================================
    var savThis = this;

    this.reBusy = true;   // inhibit recalls till this job done
    obj.dirty = false;    // inhibit re-draws until new request sets this true
    if (!noclear)
      this.clearCanvas();
    if (obj.children != undefined)  // test for a Group3D (they have children)
    {
      updateTransforms(obj);   // recursivley re-calculate the object tree transforms and apply them
      getDrawableGrps(obj);    // recursively flatten the group tree into an array of groups to be drawn
       // Depth sort the groups (painters algorithm, draw from the back to front)
      drawableGrps.sort(function (p1, p2){return p1.centroid.tz - p2.centroid.tz;});
      // do all the 3D transforms and projections
      for (var i=0; i < drawableGrps.length; i++)
      {
        var objAry = drawableGrps[i].drawObjs;
        for (var j=0; j<objAry.length; j++)
          obj3Dto2D(objAry[j]);    // pass as Obj3D
        // Depth sorting (painters algorithm, draw from the back to front)
        objAry.sort(function (p1, p2){return p1.centroid.tz - p2.centroid.tz;});
        // now render them onto the canvas
        for (var k=0; k < objAry.length; k++)
          this._paintObj3D(objAry[k], wireframe);
      }
    }
    else  // no sorting for painters algorithm needed
    {
      obj3Dto2D(obj);
      this._paintObj3D(obj, wireframe);
    }

    // did a change happen while render engine busy?
    if ((obj.children != undefined)&&(obj.dirty))     // if a Group3D, test if it changed while busy
      requestAnimationFrame(function(){savThis._render3D(obj, wireframe, noclear)});  // do it again then
    // finally cleared the job queue
    this.reBusy = false;   // allow new render calls
  }

/*========================================================
 * _paintObj3D takes an Obj3D which has been transformed
 * and projected to 2D all the canvas commands are
 * formatted but in world coordinates.
 * Convert to canvas pixels and draw them onto the canvas
 *-------------------------------------------------------*/
  Cango3D.prototype._paintObj3D = function(pg, wireframe)
  {
    var j, k;
    var pxlCoords;
    pg.pxOutline = [];   // start with new array

    this.ctx.save();   // save the current ctx we are going to change bits
    this.ctx.beginPath();
    // step through the Obj3D drawData array of commands and draw each one
    for (j=0; j < pg.drawData.length; j++)
    {
      pxlCoords = [];   // start a new array
      // convert all parms to world coords
      for (k=0; k<pg.drawData[j].parms.length; k+=2)   // step thru the coords in x,y pairs
      {
        pxlCoords[k] = this.vpLLx+this.xoffset+pg.drawData[j].parms[k]*this.xscl;
        pxlCoords[k+1] = this.vpLLy+this.yoffset+pg.drawData[j].parms[k+1]*this.yscl;
      }
      // now actually draw the path onto the canvas
      this.ctx[pg.drawData[j].drawFn].apply(this.ctx, pxlCoords);
      if (pg.type != "TEXT")
        pg.pxOutline.push(new DrawCmd(pg.drawCmds[j].drawFn, pxlCoords)); // save the 'as drawn' cmds with px coords
    }
    if (pg.type == "TEXT")
    {
      // construct the bounding box pixel coords for drag and drop
      pg.pxOutline = [];   // start with new array
      var xPx = this.vpLLx+this.xoffset+pg.ul.fx*this.xscl;
      var yPx = this.vpLLy+this.yoffset+pg.ul.fy*this.yscl;
      pg.pxOutline.push(new DrawCmd("moveTo", [xPx, yPx]));
      xPx = this.vpLLx+this.xoffset+pg.ll.fx*this.xscl;
      yPx = this.vpLLy+this.yoffset+pg.ll.fy*this.yscl;
      pg.pxOutline.push(new DrawCmd("lineTo", [xPx, yPx]));
      xPx = this.vpLLx+this.xoffset+pg.lr.fx*this.xscl;
      yPx = this.vpLLy+this.yoffset+pg.lr.fy*this.yscl;
      pg.pxOutline.push(new DrawCmd("lineTo", [xPx, yPx]));
      xPx = this.vpLLx+this.xoffset+pg.ur.fx*this.xscl;
      yPx = this.vpLLy+this.yoffset+pg.ur.fy*this.yscl;
      pg.pxOutline.push(new DrawCmd("lineTo", [xPx, yPx]));
      pg.pxOutline.push(new DrawCmd("closePath", []));
    }
    // fill and stroke the path
    if (pg.type == "SHAPE")
    {
      this.ctx.closePath();
      this.ctx.lineWidth = 1;
      if (!wireframe)
      {
        this.ctx.fillStyle = this._calcShapeShade(pg);
        this.ctx.strokeStyle = this.ctx.fillStyle;
        this.ctx.fill();
        if (pg.fillColor.a > 0.9)    // only stroke if solid color (don't stroke see-through panels)
          this.ctx.stroke();    // stroke outline
      }
      else  // wireframe - don't shade
      {
        this.ctx.strokeStyle = pg.strokeColor.toRGBA();
        this.ctx.lineCap = this.lineCap;
        this.ctx.stroke();    // stroke outline
      }
    }
    else  // PATH or TEXT
    {
      this.ctx.strokeStyle = pg.strokeColor.toRGBA();
      this.ctx.lineWidth = pg.strokeWidth;
      this.ctx.lineCap = pg.strokeCap;
      this.ctx.stroke();    // stroke outline
    }

    if (this.plotNormals)      // draw the normal
    {     // convert the centroid and normal too
      var ox = this.vpLLx+this.xoffset+pg.centroid.fx*this.xscl;
      var oy = this.vpLLy+this.yoffset+pg.centroid.fy*this.yscl;
      var nx = this.vpLLx+this.xoffset+pg.normal.fx*this.xscl;
      var ny = this.vpLLy+this.yoffset+pg.normal.fy*this.yscl;

      if (pg.centroid.tz < pg.normal.tz)    // +ve out of screen
        this.ctx.strokeStyle = "green";   // pointing toward viewer
      else
        this.ctx.strokeStyle = "red";     // pointing away from viewer

      this.ctx.beginPath();
      this.ctx.moveTo(ox, oy);
      this.ctx.lineTo(nx, ny);
      this.ctx.stroke();
    }
    // now draw the text character paths if text is toward the viewer
    if ((pg.type == "SHAPE")&&(pg.textCmds.length>0))
    {
      var norm = {x:(pg.normal.tx-pg.centroid.tx), y:(pg.normal.ty-pg.centroid.ty), z:(pg.normal.tz-pg.centroid.tz)};
      var los = new Point(0, 0, this.viewpointDistance);  // store this in the Line Of Sight vector
      /* Calculate unit vector along line of sight to decide if we are looking at front or back
         if normal dot product with LOS is +ve its the top, -ve its the back
         no need to normalise, just need the sign of dot product */
      los.tx = los.x - pg.centroid.tx;
      los.ty = los.y - pg.centroid.ty;
      los.tz = los.z - pg.centroid.tz;
      if (norm.x*los.tx + norm.y*los.ty + norm.z*los.tz < 0) // looking at back
        return;
      this.ctx.beginPath();
      // step through the Obj3D textData array of commands and draw each one
      for (j=0; j < pg.textData.length; j++)
      {
        // convert all parms to world coords
        for (k=0; k<pg.textData[j].parms.length; k+=2)   // step thru the coords in x,y pairs
        {
          pg.textData[j].parms[k] = this.vpLLx+this.xoffset+pg.textData[j].parms[k]*this.xscl;
          pg.textData[j].parms[k+1] = this.vpLLy+this.yoffset+pg.textData[j].parms[k+1]*this.yscl;
        }
        // now actually draw the path onto the canvas
        this.ctx[pg.textData[j].drawFn].apply(this.ctx, pg.textData[j].parms);
      }
      // stroke the path
      this.ctx.lineWidth = pg.strokeWidth;
      this.ctx.lineCap = "round";
      this.ctx.strokeStyle = pg.strokeColor.toRGBA();
      this.ctx.stroke();    // stroke outline
    }
    this.ctx.restore();  // put things back the way they were

    // if Drag enabled
    if (pg.dragNdrop != null)
    {
      // translate to pixel coords dwgOrg (save these for drag and drop testing)
      pg.dragNdrop.dwgOrgPx.x = this.vpLLx+this.xoffset+pg.dragNdrop.dwgOrg.x*this.xscl;
      pg.dragNdrop.dwgOrgPx.y = this.vpLLy+this.yoffset+pg.dragNdrop.dwgOrg.y*this.yscl;
      pg.dragNdrop.dwgOrgPx.z = pg.dragNdrop.dwgOrg.z*this.xscl;
      // push obj into Cango.draggable array, its checked by canvas mousedown event handler
      this.draggable.push(pg);
    }
  }

  Cango3D.prototype._calcShapeShade = function(obj)
  {
    // viewpoint is always on -z axis, viewpointDistance from coord system origin
    var los = new Point(0, 0, this.viewpointDistance);  // store this in the Line Of Sight vector
    var col;
    // work in world coords
    // calculate unit vector in direction of the sun
    var sunMag = Math.sqrt(this.lightSource.x*this.lightSource.x + this.lightSource.y*this.lightSource.y + this.lightSource.z*this.lightSource.z);
    var sun = {x:this.lightSource.x/sunMag, y:this.lightSource.y/sunMag, z:this.lightSource.z/sunMag};
    // calc unit vector normal to the panel front
    var norm = {x:(obj.normal.tx-obj.centroid.tx), y:(obj.normal.ty-obj.centroid.ty), z:(obj.normal.tz-obj.centroid.tz)};
    var normMag = Math.sqrt(norm.x*norm.x + norm.y*norm.y + norm.z*norm.z);
    norm.x /= normMag;
    norm.y /= normMag;
    norm.z /= normMag;
    // luminence is dot product of panel's normal and sun vector
    var lum = 0.7*(sun.x*norm.x + sun.y*norm.y + sun.z*norm.z); // normalise to range 0..0.7
    lum = Math.abs(lum);   // normal can be up or down (back given same shading)
    lum += 0.3;            // shift range to 0.3..1 (so base level so its not too dark)
    /* Now calculate unit vector along line of sight to decide if we are looking at front or back
       if normal dot product with LOS is +ve its the top, -ve its the bottom
       bottom might get a different colour.
       no need to normalise, just need the sign of dot product */
    los.tx = los.x - obj.centroid.tx;
    los.ty = los.y - obj.centroid.ty;
    los.tz = los.z - obj.centroid.tz;
    if (norm.x*los.tx + norm.y*los.ty + norm.z*los.tz < 0) // looking at back
    {
      //  looking at back
      col = obj.backColor;
      // back will be dark if normal (front) is pointing toward the lightSource
      if (norm.x*sun.x + norm.y*sun.y + norm.z*sun.z > 0)
        lum = 0.3;
    }
    else
    {
      // looking at the front
      col = obj.fillColor;
      // front will be dark if normal is pointing away from lightSource
      if (norm.x*sun.x + norm.y*sun.y + norm.z*sun.z < 0)
         lum = 0.3;
    }
     // calc rgb color based on V5 (component of normal to polygon in direction on POV)
    var cr = Math.round(lum*col.r);
    var cg = Math.round(lum*col.g);
    var cb = Math.round(lum*col.b);
    var ca = col.a;

    return "rgba("+cr+","+cg+","+cb+","+ca+")";     // string format 'rgba(r,g,b,a)'
  }

  /* =========================================================
   * Generate the Normal to a plane, given 3 points (3D)
   * which define a plane.
   * The vector returned starts at 0,0,0
   * is 1 unit long in direction perpendicular to the plane.
   * Calculates A X B where p2-p1=A, p3-p1=B
   * --------------------------------------------------------*/
  Cango3D.prototype.calcNormal = function(p1, p2, p3)
  {
    var n = new Point(0, 0, 1);  // default if vectors degenerate
    var a = new Point(p2.x-p1.x, p2.y-p1.y, p2.z-p1.z);   // vector from p1 to p2
    var b = new Point(p3.x-p1.x, p3.y-p1.y, p3.z-p1.z);   // vector from p1 to p3
    // a and b lie in the plane, a x b (cross product) is normal to both ie normal to plane
    // left handed coord system use left hand to get X product direction
    var nx = a.y*b.z - a.z*b.y;
    var ny = a.z*b.x - a.x*b.z;
    var nz = a.x*b.y - a.y*b.x;
    var mag = Math.sqrt(nx*nx + ny*ny + nz*nz);   // calc vector length
    if (mag)
      n = new Point(nx/mag, ny/mag, nz/mag);      // make 'unit' vector

    return n
  }

  /* =========================================================
   * Calculate the included angle between 2 vectors
   * a, from base p1 to p2, and b, from p1 to p3.
   * --------------------------------------------------------*/
  Cango3D.prototype.calcIncAngle = function(p1, p2, p3)
  {
    var angRads = 0;
    var a = new Point(p2.x-p1.x, p2.y-p1.y, p2.z-p1.z);   // vector from p1 to p2
    var b = new Point(p3.x-p1.x, p3.y-p1.y, p3.z-p1.z);   // vector from p1 to p3

    var numerator = a.x*b.x + a.y*b.y + a.z*b.z;
    var denominator	= Math.sqrt(a.x*a.x + a.y*a.y + a.z*a.z)*Math.sqrt(b.x*b.x + b.y*b.y + b.z*b.z);
    if (denominator)
      angRads = Math.acos(numerator/denominator);

    return angRads*180.0/Math.PI;
  }

  /* =======================================================================
   * objectOfRevolution3D
   * The profile described by 'path' array of Cgo3D commands will form
   * the profile of an object of revolution. 'path' coordinates will be in
   * world cordinates. An Obj3D of type PATH is made of this profile and rotated
   * by the segment angle about the Y axis, the segment end points are joined
   * to the original profile by circular arcs top and bottom defining a curved
   * panel. These panels form one segment of the shape like a segment of an
   * orange. To get color filling to work, path sections must traversed in a
   * consistant direction, CCW to get the normal pointing out of screen.
   * So one side of the panel must be tranversd backwards. This is OK, as only
   * Bezier curves and straight lines are used in Cgo3D format data.
   * Parameters:
   * path: Array of Cgo3D format commands defining the profile in the X,Y plane
   * xOfs: an offset added to profile x coordinates (correct for SVG origin offset)
   * segments: number of segments into which totalAngle is divided
   * fillColor: HTML format color string
   * bkColor: HTML format color string
   * straight: If true, straight lines used to join segments
   * returns a Group3D.
   * -----------------------------------------------------------------------*/
  Cango3D.prototype.objectOfRevolution3D = function(path, xOfs, segments, fillColor, bkCol, straight)
  {
    /*=========================================================
     * function genSvgArc()
     * Generate the SVG format array for a circular arc with
     * center as start piont (canvas style) convert to SVG style
     * The actual arc will compile to Bezier curves by Cango
     * (these can be rotated in 3D and hold their shape).
     * Assumes Cango coords, y +ve up, angles +ve CCW.
     * The arc center is at cx, cy. Arc starts from startAngle
     * and ends at endAngle. startAngle and endAngle are in
     * degrees. The arc radius is r (in world coords). If
     * antiClockwise is true the arc is traversed ccw, if false
     * it is traversed cw.
     *---------------------------------------------------------*/
    var savThis = this;
    function genSvgArc(cx, cy, r, startAngle, endAngle, antiClockwise)
    {
      var stRad = startAngle * Math.PI/180;
      var edRad = endAngle * Math.PI/180;
      var m = 0.55228475;                 // magic number for drawing circle with 4 Bezier curve

      var oy = cy + r*Math.sin(stRad);   // coords of start point for circlular arc with center (cx,cy)
      var ox = cx + r*Math.cos(stRad);
      var ey = cy + r*Math.sin(edRad);   // coords of end point for circlular arc with center (cx,cy)
      var ex = cx + r*Math.cos(edRad);
      var rotX = 0;     // tilt of x axis, always 0 for circular arc
      var lrgArc = 0;   // always use small so 0
      var ccw = (antiClockwise? 1 : 0);
      var delta = 0;
      var svgData, seg;
      var swp = 1 - ccw;       // 0=ccw 1=cw   (flipped for this ccw +ve world)

      delta = (ccw)? edRad - stRad :stRad - edRad;
      if (delta < 0)
        delta += 2*Math.PI;
      if (delta > 2* Math.PI)
        delta -= 2*Math.PI;
      lrgArc = delta > Math.PI? 1: 0;

      // dont try to draw full circle or no circle
      if ((Math.abs(delta) < 0.01) || (Math.abs(delta) > 2*Math.PI-0.01))
        svgData = ["M",cx, cy-r,"C",cx+m*r, cy-r, cx+r, cy-m*r, cx+r, cy,   cx+r, cy+m*r, cx+m*r, cy+r, cx, cy+r,  cx-m*r, cy+r, cx-r, cy+m*r, cx-r, cy, cx-r, cy-m*r, cx-m*r, cy-r, cx, cy-r];
      else
        svgData = ["M", ox, oy, "A", r, r, 0, lrgArc, swp, ex, ey];

      return savThis.svgToCgo3D(svgData)
    }

    var pathObj = this.compilePath3D(path);
    var grp = this.createGroup3D();
    var startX = 0;
    var startY = 0;
    var endX = 0;
    var endY = 0;
    var panel, panelCmds, pp1Cmds, panelObj;
    var topRim, botRim;
    var topRimObj, botRimObj, topRimCmds;
    var segs = segments || 6;
    var segAng = 360 / segs;           // included angle of each segment
    var segRad = segAng*Math.PI/180;
    var color = this.paintCol;
    var bkColor = color;
    if (typeof fillColor != 'undefined')
      color = fillColor;
    if (typeof bkCol != 'undefined')
      bkColor = bkCol;
    var r;
    var st = 1;         // which segment to start building from
    var sp = pathObj.drawCmds.length;
    var topObj;
    // Check if top can be made in a single piece
    if (((pathObj.drawCmds[0].ep.x+xOfs)*this.xscl < 3)&&(pathObj.drawCmds[0].ep.y == pathObj.drawCmds[1].ep.y))
    {
      // make the top
      r = pathObj.drawCmds[1].ep.x;
      if (straight)
      {
        var topData = ['M',r,0,0];
        for (var i=1; i<segments; i++)
        {
          topData.push('L',r*Math.cos(i*segRad),r*Math.sin(i*segRad),0);
        }
        topData.push('Z');
        topObj = this.compileShape3D(topData, color, bkColor);
      }
      else
      {
        topObj = this.compileShape3D(shapeDefs.circle, color, bkColor, 2*r);
      }
      // flip over to xz plane
      topObj.rotate(1, 0, 0, -90);
      // lift up to startY
      topObj.translate(0,pathObj.drawCmds[0].ep.y,0);
      grp.addObj(topObj);
      st = 2;  // skip the first section of the profile its done
    }
    // Check if bottom can be made in a single piece
    if (((pathObj.drawCmds[sp-1].ep.x+xOfs)*this.xscl < 3)&&(pathObj.drawCmds[sp-1].ep.y == pathObj.drawCmds[sp-2].ep.y))
    {
      // make the bottom
      r = pathObj.drawCmds[sp-2].ep.x;
      if (straight)
      {
        var botData = ['M',r,0,0];
        for (var i=1; i<segments; i++)
        {
          botData.push('L',r*Math.cos(i*segRad),r*Math.sin(i*segRad),0);
        }
        botData.push('Z');
        botObj = this.compileShape3D(botData, color, bkColor);
      }
      else
      {
        botObj = this.compileShape3D(shapeDefs.circle, color, bkColor, 2*r);
      }
      // flip over to xz plane
      botObj.rotate(1, 0, 0, 90);
      // lift up to end Y
      botObj.translate(0,pathObj.drawCmds[sp-1].ep.y,0);
      grp.addObj(botObj);
      sp -= 1;  // skip the last section of the profile its done
    }
    var profile_0 = pathObj.clone(); // make a copy
    var profile_1 = pathObj.clone(); // two needed (not new reference)
    // move the profile by xOfs, useful for SVG copied profiles
    profile_0.translate(xOfs, 0, 0);
    profile_1.translate(xOfs, 0, 0);
    // now this profile must be rotated by the segment angle to form the other side
    profile_1.rotate(0, 1, 0, segAng);   // rotate segment by segAng out of screen

    for (var n=0; n<segs; n++)
    {
      for (var m = st; m < sp; m++)
      {
        // construct a panel from top and bottom arcs and 2 copies of profile segment
        if (profile_0.drawCmds[m-1].ep.x*this.xscl < 3)   // truncate to 1st Quadrant
        {
          profile_0.drawCmds[m-1].ep.x = 0;
          profile_1.drawCmds[m-1].ep.x = 0;
        }
        startX = profile_0.drawCmds[m-1].ep.x;
        startY = profile_0.drawCmds[m-1].ep.y;
        endX = profile_0.drawCmds[m].ep.x;
        endY = profile_0.drawCmds[m].ep.y;
        if (startX*this.xscl >= 3) // make a topRim if profile doesn't start at center
        {
          // top rim (drawn in xy), endpoint will be where this profile slice starts
          if (straight)
            topRim = ['M',startX*Math.cos(segRad),startX*Math.sin(segRad),0, 'L',startX,0,0];
          else
            topRim = genSvgArc(0, 0, startX, segAng, 0, 0);  // generate SVG cmds for top arc
          // shove them into an object to enable rotate and translate
          topRimObj = this.compilePath3D(topRim, color);
          // topRim is in xy plane must be rotated to be in xz plane to join profile
          topRimObj.rotate(1, 0, 0, -90);      // flip top out of screen
          topRimObj.translate(0, startY, 0);   // move up from y=0 to top of profile slice
          // use topRim drawCmds to start the panel array of DrawCmd3Ds
          panel = topRimObj.drawCmds;
        }
        else
        {
          // construct a moveTo command from end point of last command
          topRimCmds = new DrawCmd3D("moveTo", [], profile_0.drawCmds[m-1].ep.clone());
          panel = [topRimCmds];     // use this to start the panel DrawCmd3Ds array
        }
        // copy the profile_0's DrawCmd3D for this segment, push it into panel drawCmds
        panelCmds = profile_0.drawCmds[m].clone();
        panel.push(panelCmds);
        if (endX > 3)  // make the bottom rim if it has any size
        {
          if (straight)
            botRim = ['M',endX,0,0, 'L',endX*Math.cos(-segRad),endX*Math.sin(-segRad),0];
          else
            botRim = genSvgArc(0, 0, endX, 0, -segAng, 0);
          // shove them into an object to enable rotate and translate
          botRimObj = this.compilePath3D(botRim, color);
          // rim is in xy plane rotate to be in xz plane
          botRimObj.rotate(1, 0, 0, 90);       // flip bottom up to be out of screen
          botRimObj.translate(0, endY, 0);   // move down from y=0 to bottom of profile
          // now this is an moveTo and a bezierCurveTo, drop the 'moveTo'
          panel.push(botRimObj.drawCmds[1]);  // only 1 Bezier here
        }
        // construct a DrawCmd3D going backward up profile_1
        pp1Cmds = new DrawCmd3D(profile_1.drawCmds[m].drawFn.slice(0), [], profile_1.drawCmds[m-1].ep.clone());
        // change order of cPts if its a Bezier
        if (profile_1.drawCmds[m].cPts.length)
        {
          pp1Cmds.cPts.push(profile_1.drawCmds[m].cPts[1].clone());
          pp1Cmds.cPts.push(profile_1.drawCmds[m].cPts[0].clone());
        }
        panel.push(pp1Cmds);  // now add retrace path to the panel commands
        // make an Obj3D for this panel
        panelObj = new Obj3D(this, panel, "SHAPE", color, bkColor);
        // now add the complete panel to the array which makes the final shape
        grp.addObj(panelObj);
      }
      // rotate the previously made panels out of the way of next segment
      grp.rotate(0, 1, 0, segAng);
    }
    return grp;
  }

  /* ========================================================================
   * Convert Cgo3D data array ['M',x,y,z, 'L',x,y,z, ... 'Q',cx,cy,cz,x,y,z ]
   * to DrawCmd3Ds {drawFn:'moveTo', cPts:[], ep:{x,y,z..}}
   * -----------------------------------------------------------------------*/
  Cango3D.prototype._cgo3DtoDrawCmd3D = function(segs, xRef, yRef, zRef, scl)
  {
    var x = 0;
    var y = 0;
    var z = 0;
    var cPts;        // array of control points
    var ep;          // end point
    var px,py,pz;
    var c1x,c1y,c1z;
    var seg, cmd, pc;
    var cmdObj;
    var commands = [];
    var xScale = scl || 1;        // only allow isotropic scaling
    var yScale = xScale;
    var zScale = xScale;
    var xOfs = xRef || 0;         // move the shape reference point
    var yOfs = yRef || 0;
    var zOfs = zRef || 0;

    for (var i=0; i<segs.length; i++)
    {
      seg = segs[i];
      cmd = seg[0];
      if ((i==0)&&(cmd != 'M'))   // check that the first move is absolute
        cmd = 'M';
      var coords = seg.slice(1);
      if (coords)
        coords = coords.map(parseFloat);
      switch(cmd)
      {
        case 'M':
          x = xOfs + xScale*coords[0];
          y = yOfs + yScale*coords[1];
          z = zOfs + zScale*coords[2];
          px = py = pz = null;
          cPts = [];
          ep = new Point(x, y, z);
          cmdObj = new DrawCmd3D('moveTo', cPts, ep);
          commands.push(cmdObj);
          coords.splice(0, 3);      // delete the 3 coords from the front of the array
          while (coords.length>0)
          {
            x = xOfs + xScale*coords[0];                // eqiv to muliple 'L' calls
            y = yOfs + yScale*coords[1];
            z = zOfs + zScale*coords[2];
            cPts = [];
            ep = new Point(x, y, z);
            cmdObj = new DrawCmd3D('lineTo', cPts, ep); // any coord pair after first move is regarded as line
            commands.push(cmdObj);
            coords.splice(0, 3);
          }
          break
        case 'm':
          x += xScale*coords[0];
          y += yScale*coords[1];
          z += zScale*coords[2];
          px = py = pz = null;
          cPts = [];
          ep = new Point(x, y, z);
          cmdObj = new DrawCmd3D('moveTo', cPts, ep);
          commands.push(cmdObj);
          coords.splice(0, 3);      // delete the 3 coords from the front of the array
          while (coords.length>0)
          {
            x += xScale*coords[0];                     // eqiv to muliple 'l' calls
            y += yScale*coords[1];
            z += zScale*coords[2];
            cPts = [];
            ep = new Point(x, y, z);
            cmdObj = new DrawCmd3D('lineTo', cPts, ep); // any coord pair after first move is regarded as line
            commands.push(cmdObj);
            coords.splice(0, 3);
          }
          break
  
        case 'L':
          while (coords.length>0)
          {
            x = xOfs + xScale*coords[0];
            y = yOfs + yScale*coords[1];
            z = zOfs + zScale*coords[2];
            cPts = [];
            ep = new Point(x, y, z);
            cmdObj = new DrawCmd3D('lineTo', cPts, ep);
            commands.push(cmdObj);
            coords.splice(0, 3);
          }
          px = py = null;
          break
        case 'l':
          while (coords.length>0)
          {
            x += xScale*coords[0];
            y += yScale*coords[1];
            z += zScale*coords[2];
            cPts = [];
            ep = new Point(x, y, z);
            cmdObj = new DrawCmd3D('lineTo', cPts, ep);
            commands.push(cmdObj);
            coords.splice(0, 3);
          }
          px = py = null
          break
        case 'C':
          while (coords.length>0)
          {
            c1x = xOfs + xScale*coords[0];
            c1y = yOfs + yScale*coords[1];
            c1z = zOfs + zScale*coords[2];
            px = xOfs + xScale*coords[3];
            py = yOfs + yScale*coords[4];
            pz = zOfs + zScale*coords[5];
            x = xOfs + xScale*coords[6];
            y = yOfs + yScale*coords[7];
            z = zOfs + zScale*coords[8];
            cPts = [];
            cPts[0] = new Point(c1x, c1y, c1z);
            cPts[1] = new Point(px, py, pz);
            ep = new Point(x, y, z);
            cmdObj = new DrawCmd3D('bezierCurveTo', cPts, ep);
            commands.push(cmdObj);
            coords.splice(0, 9);
          }
          break
        case 'c':
          while (coords.length>0)
          {
            c1x = x + xScale*coords[0];
            c1y = y + yScale*coords[1];
            c1z = z + zScale*coords[2];
            px = x + xScale*coords[3];
            py = y + yScale*coords[4];
            pz = z + zScale*coords[5];
            x += xScale*coords[6];
            y += yScale*coords[7];
            z += zScale*coords[8];
            cPts = [];
            cPts[0] = new Point(c1x, c1y, c1z);
            cPts[1] = new Point(px, py, pz);
            ep = new Point(x, y, 0);
            cmdObj = new DrawCmd3D('bezierCurveTo', cPts, ep);
            commands.push(cmdObj);
            coords.splice(0, 9);
          }
          break
        case 'Q':
          px = xOfs + xScale*coords[0];
          py = yOfs + yScale*coords[1];
          pz = zOfs + zScale*coords[2];
          x = xOfs + xScale*coords[3];
          y = yOfs + yScale*coords[4];
          z = zOfs + zScale*coords[5];
          cPts = [];
          cPts[0] = new Point(px, py, pz);
          ep = new Point(x, y, z);
          cmdObj = new DrawCmd3D('quadraticCurveTo', cPts, ep);
          commands.push(cmdObj);
          break
        case 'q':
          cPts = [];
          cPts[0] = new Point(x + xScale*coords[0], y + yScale*coords[1], z + zScale*coords[2]);
          ep = new Point(x + xScale*coords[3], y + yScale*coords[4], z + zScale*coords[5]);
          cmdObj = new DrawCmd3D('quadraticCurveTo', cPts, ep);
          commands.push(cmdObj);
          px = x + xScale*coords[0];
          py = y + yScale*coords[1];
          pz = z + zScale*coords[2];
          x += xScale*coords[3];
          y += yScale*coords[4];
          z += zScale*coords[5];
          break
        case 'Z':
          cmdObj = new DrawCmd3D('closePath');
          commands.push(cmdObj);
          break
        case 'z':
          cmdObj = new DrawCmd3D('closePath');
          commands.push(cmdObj);
          break
      }
      pc = cmd     // save the previous command for possible reflected control points
    }
    return commands
  }
  
  /* ========================================================================
   * Convert SVG format 2D data which can be either a String or an Array
   * in format "M, x, y, L, x, y ... " or ['M', x, y, 'L', x, y ... ]
   * to Cgo3D array ['M',x,y,z, 'L',x,y,z, ... 'Q',cx,cy,cz,x,y,z ]
   * Path data from SVG editors often have the drawing origin offset a long
   * way, xRef, yRef will be added to all coords to correct this
   * NOTE: String format data is assumed to be Y +ve down and so all
   * Y coordinates are flipped in sign. This does not happen to array data.
   * -----------------------------------------------------------------------*/
  Cango3D.prototype.svgToCgo3D = function(svgPath, xRef, yRef)
  {

    function segmentToBezier(cx, cy, th0, th1, rx, ry, sin_th, cos_th)
    {
      var a00 = cos_th * rx;
      var a01 = -sin_th * ry;
      var a10 = sin_th * rx;
      var a11 = cos_th * ry;

      var th_half = 0.5 * (th1 - th0);
      var t = (8/3) * Math.sin(th_half * 0.5) * Math.sin(th_half * 0.5) / Math.sin(th_half);
      var x1 = cx + Math.cos(th0) - t * Math.sin(th0);
      var y1 = cy + Math.sin(th0) + t * Math.cos(th0);
      var x3 = cx + Math.cos(th1);
      var y3 = cy + Math.sin(th1);
      var x2 = x3 + t * Math.sin(th1);
      var y2 = y3 - t * Math.cos(th1);
      return [ a00 * x1 + a01 * y1, a10 * x1 + a11 * y1,
               a00 * x2 + a01 * y2, a10 * x2 + a11 * y2,
               a00 * x3 + a01 * y3, a10 * x3 + a11 * y3 ];
    }

    function arcToBezier(ox, oy, rx, ry, rotateX, large, sweep, x, y)
    {
      var th = rotateX * (Math.PI/180);
      var sin_th = Math.sin(th);
      var cos_th = Math.cos(th);
      rx = Math.abs(rx);
      ry = Math.abs(ry);
      var px = cos_th * (ox - x) * 0.5 + sin_th * (oy - y) * 0.5;
      var py = cos_th * (oy - y) * 0.5 - sin_th * (ox - x) * 0.5;
      var pl = (px*px) / (rx*rx) + (py*py) / (ry*ry);
      if (pl > 1)
      {
        pl = Math.sqrt(pl);
        rx *= pl;
        ry *= pl;
      }

      var a00 = cos_th / rx;
      var a01 = sin_th / rx;
      var a10 = (-sin_th) / ry ;
      var a11 = (cos_th) / ry;
      var x0 = a00 * ox + a01 * oy;
      var y0 = a10 * ox + a11 * oy;
      var x1 = a00 * x + a01 * y;
      var y1 = a10 * x + a11 * y;

      var d = (x1-x0) * (x1-x0) + (y1-y0) * (y1-y0);
      var sfactor_sq = 1 / d - 0.25;
      if (sfactor_sq < 0)
        sfactor_sq = 0;
      var sfactor = Math.sqrt(sfactor_sq);
      if (sweep == large)
        sfactor = -sfactor;
      var xc = 0.5 * (x0 + x1) - sfactor * (y1-y0);
      var yc = 0.5 * (y0 + y1) + sfactor * (x1-x0);

      var th0 = Math.atan2(y0-yc, x0-xc);
      var th1 = Math.atan2(y1-yc, x1-xc);

      var th_arc = th1-th0;
      if (th_arc < 0 && sweep == 1)
      {
        th_arc += 2*Math.PI;
      }
      else if (th_arc > 0 && sweep == 0)
      {
        th_arc -= 2 * Math.PI;
      }

      var segments = Math.ceil(Math.abs(th_arc / (Math.PI * 0.5 + 0.001)));
      var result = [];
      for (var i=0; i<segments; i++)
      {
        var th2 = th0 + i * th_arc / segments;
        var th3 = th0 + (i+1) * th_arc / segments;
        result.push(segmentToBezier(xc, yc, th2, th3, rx, ry, sin_th, cos_th));
      }

      return result;
    }

    function segsToCgo3D(segs, xRef, yRef, xScl, yScl)
    {
      var x = 0;
      var y = 0;
      var z = 0;
      var c1x, c1y, px,py;
      var rx, ry, rot, larc, swp, arc_segs;
      var seg, cmd, pc;
      var commands = [];
      var xScale = xScl || 1;
      var yScale = yScl || xScale;          // in case only single scale factor passed
      var xOfs = xRef || 0;                 // move the shape reference point
      var yOfs = yRef || 0;

      for (var i=0; i<segs.length; i++)
      {
        seg = segs[i];
        cmd = seg[0];
        if ((i==0)&&(cmd != 'M'))   // check that the first move is absolute
          cmd = 'M';
        var coords = seg.slice(1);      // skip the command copy coords
        if (coords)
          coords = coords.map(parseFloat);
        switch(cmd)
        {
          case 'M':
            x = xOfs + xScale*coords[0];
            y = yOfs + yScale*coords[1];
            z = 0;
            px = py = null;
            commands.push('M', x, y, z);
            coords.splice(0, 2);      // delete the 2 coords from the front of the array
            while (coords.length>0)
            {
              x = xOfs + xScale*coords[0];                // eqiv to muliple 'L' calls
              y = yOfs + yScale*coords[1];
              z = 0;
              commands.push('L', x, y, z); // coords after first move is regarded as line
              coords.splice(0, 2);
            }
            break
          case 'm':
            x += xScale*coords[0];
            y += yScale*coords[1];
            z = 0;
            px = py = null;
            commands.push('M', x, y, z);
            coords.splice(0, 2);      // delete the 2 coords from the front of the array
            while (coords.length>0)
            {
              x += xScale*coords[0];              // eqiv to muliple 'l' calls
              y += yScale*coords[1];
              z = 0;
              commands.push('L', x, y, z); // any coord pair after first move is regarded as line
              coords.splice(0, 2);
            }
            break

          case 'L':
            while (coords.length>0)
            {
              x = xOfs + xScale*coords[0];
              y = yOfs + yScale*coords[1];
              z = 0;
              commands.push('L', x, y, z);
              coords.splice(0, 2);
            }
            px = py = null;
            break
          case 'l':
            while (coords.length>0)
            {
              x += xScale*coords[0];
              y += yScale*coords[1];
              z = 0;
              commands.push('L', x, y, z);
              coords.splice(0, 2);
            }
            px = py = null
            break
          case 'H':
            x = xOfs + xScale*coords[0];
            px = py = null ;
            commands.push('L', x, y, z);
            break
          case 'h':
            x += xScale*coords[0];
            px = py = null ;
            commands.push('L', x, y, z);
            break
          case 'V':
            y = yOfs + yScale*coords[0];
            px = py = null;
            commands.push('L', x, y, z);
            break
          case 'v':
            y += yScale*coords[0];
            px = py = null;
            commands.push('L', x, y, z);
            break
          case 'C':
            while (coords.length>0)
            {
              c1x = xOfs + xScale*coords[0];
              c1y = yOfs + yScale*coords[1];
              px = xOfs + xScale*coords[2];
              py = yOfs + yScale*coords[3];
              x = xOfs + xScale*coords[4];
              y = yOfs + yScale*coords[5];
              z = 0;
              commands.push('C', c1x, c1y, 0, px, py, 0, x, y, z);
              coords.splice(0, 6);
            }
            break
          case 'c':
            while (coords.length>0)
            {
              c1x = x + xScale*coords[0];
              c1y = y + yScale*coords[1];
              px = x + xScale*coords[2];
              py = y + yScale*coords[3];
              x += xScale*coords[4];
              y += yScale*coords[5];
              z = 0;
              commands.push('C', c1x, c1y, 0, px, py, 0, x, y, z);
              coords.splice(0, 6);
            }
            break
          case 'S':
            if (px == null || !pc.match(/[sc]/i))
            {
              px = x;                // already absolute coords
              py = y;
            }
            commands.push('C', x-(px-x), y-(py-y), 0,
                              xOfs + xScale*coords[0], yOfs + yScale*coords[1], 0,
                              xOfs + xScale*coords[2], yOfs + yScale*coords[3], 0);
            px = xOfs + xScale*coords[0];
            py = yOfs + yScale*coords[1];
            x = xOfs + xScale*coords[2];
            y = yOfs + yScale*coords[3];
            break
          case 's':
            if (px == null || !pc.match(/[sc]/i))
            {
              px = x;
              py = y;
            }
            commands.push('C', x-(px-x), y-(py-y), 0,
                              x + xOfs + xScale*coords[0], y + yOfs + yScale*coords[1], 0,
                              x + xOfs + xScale*coords[2], y + yOfs + yScale*coords[3], 0);
            px = x + xScale*coords[0];
            py = y + yScale*coords[1];
            x += xScale*coords[2];
            y += yScale*coords[3];
            break
          case 'Q':
            px = xOfs + xScale*coords[0];
            py = yOfs + yScale*coords[1];
            x = xOfs + xScale*coords[2];
            y = yOfs + yScale*coords[3];
            z = 0;
            commands.push('Q', px, py, 0, x, y, z);
            break
          case 'q':
            commands.push('Q', x + xScale*coords[0], y + yScale*coords[1], 0,
                              x + xScale*coords[2], y + yScale*coords[3], 0);
            px = x + xScale*coords[0];
            py = y + yScale*coords[1];
            x += xScale*coords[2];
            y += yScale*coords[3];
            break
          case 'T':
            if (px == null || !pc.match(/[qt]/i))
            {
              px = x;
              py = y;
            }
            else
            {
              px = x-(px-x);
              py = y-(py-y);
            }
            commands.push('Q', px, py, 0, xOfs + xScale*coords[0], yOfs + yScale*coords[1], 0);
            px = x-(px-x);
            py = y-(py-y);
            x = xOfs + xScale*coords[0];
            y = yOfs + yScale*coords[1];
            break
          case 't':
            if (px == null || !pc.match(/[qt]/i))
            {
              px = x;
              py = y;
            }
            else
            {
              px = x-(px-x);
              py = y-(py-y);
            }
            commands.push('Q', px, py, 0, x + xScale*coords[0], y + yScale*coords[1], 0);
            x += xScale*coords[0];
            y += yScale*coords[1];
            break
          case 'A':
            while (coords.length>0)
            {
              px = x;
              py = y;
              rx = xScale*coords[0];
              ry = xScale*coords[1];
              rot = -coords[2];          // rotationX: swap for CCW +ve
              larc = coords[3];          // large arc    should be ok
              swp = 1 - coords[4];       // sweep: swap for CCW +ve
              x = xOfs + xScale*coords[5];
              y = yOfs + yScale*coords[6];
              z = 0;
              arc_segs = arcToBezier(px, py, rx, ry, rot, larc, swp, x, y);
              for (var l=0; l<arc_segs.length; l++)
              {
                commands.push('C', arc_segs[l][0], arc_segs[l][1], 0,
                                   arc_segs[l][2], arc_segs[l][3], 0,
                                   arc_segs[l][4], arc_segs[l][5], 0);
              }
              coords.splice(0, 7);
            }
            break
          case 'a':
            while (coords.length>0)
            {
              px = x;
              py = y;
              rx = xScale*coords[0];
              ry = xScale*coords[1];
              rot = -coords[2];          // rotationX: swap for CCW +ve
              larc = coords[3];          // large arc    should be ok
              swp = 1 - coords[4];       // sweep: swap for CCW +ve
              x += xScale*coords[5];
              y += yScale*coords[6];
              arc_segs = arcToBezier(px, py, rx, ry, rot, larc, swp, x, y);
              for (var l=0; l<arc_segs.length; l++)
              {
                commands.push('C', arc_segs[l][0], arc_segs[l][1], 0,
                                   arc_segs[l][2], arc_segs[l][3], 0,
                                   arc_segs[l][4], arc_segs[l][5], 0);
              }
              coords.splice(0, 7);
            }
            break
          case 'Z':
            commands.push('Z');
             break
          case 'z':
            commands.push('Z');
            break
        }
        pc = cmd     // save the previous command for possible reflected control points
      }
      return commands
    }

    var cgoData;

    if (typeof svgPath == 'string')
    {
      // this is a preprocessor to get an svg Path string into 'Cango3D' format
      var segs = [];
      var cmd, seg, cmdLetters, coords;
      var strs = svgPath.split(/(?=[a-df-z])/i);  // avoid e in exponents
      // now we have an array of strings with command letter start to each

      for (var i=0; i<strs.length; i++)
      {
        seg = strs[i];
        // get command letter into an array
        cmdLetters = seg.match(/[a-z]/i);
        if (!cmdLetters)
          return [];
        cmd = cmdLetters.slice(0,1);
        if ((i==0)&&(cmd[0] != 'M'))   // check that the first move is absolute
          cmd[0] = 'M';
        coords = seg.match(/[-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?/gi);
        if (coords)
          coords = coords.map(parseFloat);
        segs.push(cmd.concat(coords));
      }
      // now send these off to the svg segs to canvas Cgo3D processor

      var xScale = 1;
      var yScale = -1;                        // flip all the y coords to +ve up
      var xOfs = xRef || 0;                 // move the path reference point
      var yOfs = -yRef || 0;

      cgoData = segsToCgo3D(segs, xOfs, yOfs, xScale, yScale);
    }
    else
    {
      if (!isArray(svgPath))
        return;

      var segs = [];
      var i, j;
      for(j=0, i=1; i<svgPath.length; i++)
      {
        if (typeof svgPath[i] == 'string')
        {
          segs.push(svgPath.slice(j,i));
          j = i;
        }
      }
      segs.push(svgPath.slice(j,i));    // push the last command out
      // now send these off to the svg segs-to-canvas DrawCmd processor
      var scale = 1;
      var xOfs = 0;                 // move the shape reference point
      var yOfs = 0;

      cgoData = segsToCgo3D(segs, xOfs, yOfs, scale, scale);
    }

    return cgoData;  // array in Cgo3D format ['M', x, y, z, 'L', x, y, z, ....]
  }







  /* =============================================================
   * DrawCmd3D
   * - drawFn: String, the canvas draw command name
   * - cPts: Array, [Point, Point ...] Bezier curve control points
   * - ep: Point, end point of the drawFn
   *-------------------------------------------------------------*/
  function DrawCmd3D(cmdStr, controlPoints, endPoint)
  {
    this.drawFn = cmdStr;   // String version of the canvas command to call
    this.cPts = controlPoints || [];  // array of parameters to pass to drawFn
    this.ep = endPoint;         //may be undefined (for 'Z')
  }

  /* ======================================================================
   * DrawCmd is a HTML5 canvas 2D draw command in the form of a string
   * this.drawFn (eg "moveTo") and a set of 2D coords 'this.parms' to pass
   * to the command (eg [5, 20] the pen will move to 5,20 in canvas coords.
   * ---------------------------------------------------------------------*/
  if (typeof DrawCmd == 'undefined')   // avoid clash with DrawCmd from 2D canvas graphics
  {
    function DrawCmd(cmdStr, coords)
    {
      this.drawFn = cmdStr;       // String version of the canvas command to call
      this.parms = coords || [];  // array of parameters to pass to drawFn
    }
  }

  function Obj3D(cgo, commands, type, col, bkCol, dragObj)
  {
    this.cgo = cgo;                  // save the Cango context
    this.type = type;                // PATH, SHAPE, TEXT
    this.drawCmds = commands || [];  // array of DrawCmd3D objects
    this.drawData = [];              // 2D draw commands in format {string, [points]}
    this.pxOutline = [];             // array of DrawCmd holding 'as rendered' cmds and pixel coords
    this.strokeColor = new RGBAColor('black');   // used for PATHs and TEXT
    this.fillColor = new RGBAColor('gray');      // used to fill SHAPEs
    this.backColor = new RGBAColor('steelblue'); //  "    "   "    "
    this.strokeWidth = 1;
    this.strokeCap = "butt";
    this.centroid = new Point(0, 0, 0); // average of x, y, z coords
    this.normal = new Point(0, 0, 0);   // from centroid, normal to object plane
    this.textCmds = [];                 // holds cmds to draw SHAPE label
    this.textData = [];                 // 2D draw commands in format {string, [points]}
    this.ul = new Point(0, 0, 0);       // vertices of the text outline box
    this.ur = new Point(0, 0, 0);
    this.ll = new Point(0, 0, 0);
    this.lr = new Point(0, 0, 0);
    this.grpTfm = new Transform3D();    // Parent Group's current transform
    this.ofsTfm = new Transform3D();    // Obj3D's offset from any parent Group's current transform
    this.netTfm = new Transform3D();    // product of parent Group netTfm applied to this.ofsTfm
    this.dragNdrop = dragObj || null;

    if ((typeof(cgo) != 'undefined')&&(cgo != null)&&(commands.length))
    {
      var newCol = new RGBAColor(col);
      if (newCol.ok)
      {
        this.fillColor = newCol;
        this.strokeColor = newCol;
      }
      else   // not a color
      {
        this.fillColor = cgo.paintCol;
        this.strokeColor = cgo.penCol;
      }
      // only SHAPEs pass bkCol  (it is ignored for PATHs)
      var newBkCol = new RGBAColor(bkCol);
      if (newBkCol.ok)
        this.backColor = newBkCol;
      else   // not a color
        this.backColor = this.fillColor;

      this.strokeCap = (type ==  "TEXT")? "round": cgo.lineCap;
      this.strokeWidth = cgo.penWid;

      var xSum = 0;
      var ySum = 0;
      var zSum = 0;
      var numPts = 0;    // total point counter for all commands
      for (var i=0; i<this.drawCmds.length; i++)
      {
        if (this.drawCmds[i].ep != undefined)  // check for Z command, has no coords
        {
          xSum += this.drawCmds[i].ep.x;
          ySum += this.drawCmds[i].ep.y;
          zSum += this.drawCmds[i].ep.z;
          numPts++;
        }
      }
      this.centroid.x = xSum/numPts;
      this.centroid.y = ySum/numPts;
      this.centroid.z = zSum/numPts;

      if (this.drawCmds.length > 2)
      {
        // make the normal(o, a, b)  = aXb, = vector from centroid to data[0], b = centroid to data[1]
        this.normal = cgo.calcNormal(this.centroid, this.drawCmds[1].ep, this.drawCmds[2].ep);
        // NOTE: traverse CCW, normal is out of screen (+z), traverse path CW, normal is into screen (-z)
        //make 10 pixels long (independent of world coords
        this.normal.x *= 10/cgo.xscl;
        this.normal.y *= 10/cgo.xscl;
        this.normal.z *= 10/cgo.xscl;
      }
      else
      {
        if (this.drawCmds.length == 2)    // if Bezier it will need a normal
        {
          if (this.drawCmds[1].cPts.length)
            this.normal = cgo.calcNormal(this.centroid, this.drawCmds[1].ep, this.drawCmds[1].cPts[0]);
          else
            // straight line make normal for completeness
            this.normal.z = 10/cgo.xscl;
        }
        else
          return;
      }
      // move normal to start from the centroid
      this.normal.x += this.centroid.x;
      this.normal.y += this.centroid.y;
      this.normal.z += this.centroid.z;
    }
    if (this.dragNdrop != null)
    {
      this.dragNdrop.parent = this;    // give dragNdrop callBacks easy access to the object
    }
  }

  /*=========================================================
   * Obj3D.transform
   * Apply a transform matrix every point in an Obj3D outline
   * path, along with the centroid and normal, by this matrix.
   * This is a SOFT transform, the transformed x,y,z values
   * are stored as tx,ty,tz they do not overwrite the current
   * x,y,z values.
   *
   * This function should be used for animation not
   * construction of a shape.
   *---------------------------------------------------------
   */
  Obj3D.prototype.transform = function(xfrm)   // pass a Transform3D object
  {
    // save the new transform as an offset from any parent group transform
    if (typeof(xfrm) != 'undefined')
      this.ofsTfm = xfrm;
    // now re-calc the netTfm
    this.netTfm.matrix = matrixMultiply4x4(this.ofsTfm.matrix, this.grpTfm.matrix);
    // now apply this to all the coordinates
    var j, k;
    for(j=0; j < this.drawCmds.length; j++)   // step through the draw segments
    {
      for (k=0; k<this.drawCmds[j].cPts.length; k++)   // transform each 3D Point
      {
        softTransformPoint(this.drawCmds[j].cPts[k], this.netTfm.matrix);
      }
      // add the end point (check it exists since 'closePath' has no end point)
      if (this.drawCmds[j].ep != undefined)
      {
        softTransformPoint(this.drawCmds[j].ep, this.netTfm.matrix);
      }
    }
    softTransformPoint(this.centroid, this.netTfm.matrix);  // translate the centroid
    softTransformPoint(this.normal, this.netTfm.matrix);    // translate the normal
    // now the drawing origin
    if (this.dragNdrop != null)
    {
      var dOrg = new Point(0, 0, 0);          // this is the un-transformed drawing origin
      softTransformPoint(dOrg, this.netTfm.matrix);    // translate, (rotate, scale) the drawing origin
      this.dragNdrop.dwgOrg.x = dOrg.tx;    // save world coords of drawing origin for drag and drop handlers
      this.dragNdrop.dwgOrg.y = dOrg.ty;
      this.dragNdrop.dwgOrg.z = dOrg.tz;
    }
    // now transform the text bounding box
    if (this.type == "TEXT")
    {
      softTransformPoint(this.ul, this.netTfm.matrix);
      softTransformPoint(this.ur, this.netTfm.matrix);
      softTransformPoint(this.ll, this.netTfm.matrix);
      softTransformPoint(this.lr, this.netTfm.matrix);
    }
    if (this.textCmds.length>0)
    {
      for(j=0; j<this.textCmds.length; j++)   // step through the draw segments
      {
        for (k=0; k<this.textCmds[j].cPts.length; k++)   // transform each 3D Point
        {
          softTransformPoint(this.textCmds[j].cPts[k], this.netTfm.matrix);
        }
        // add the end point (check it exists since 'closePath' has no end point)
        if (this.textCmds[j].ep != undefined)
        {
          softTransformPoint(this.textCmds[j].ep, this.netTfm.matrix);
        }
      }
    }
  }

  /*=========================================================
   * Obj3D.translate
   * Generate a transform matrix to translate a 3D point
   * away to a position x,y,z from 0,0,0 the drawing origin.
   * Then multiply every point in an Obj3D outline path,
   * along with the centroid and normal, by this matrix.
   * The transformed x,y,z values overwrite the current
   * values.
   *
   * This function should be used in shape
   * construction not animation. Animation doesn't change
   * x,y,z, it uses them to get tx,ty,tz.
   *---------------------------------------------------------
   */
  Obj3D.prototype.translate = function(x, y, z)
  {
    var j, k;
    var xVal = x || 0;
    var yVal = y || 0;
    var zVal = z || 0;

    var transMat = [ [   1,    0,    0, 0],
                     [   0,    1,    0, 0],
                     [   0,    0,    1, 0],
                     [xVal, yVal, zVal, 1] ];

    for(j=0; j < this.drawCmds.length; j++)   // step through the draw segments
    {
      for (k=0; k<this.drawCmds[j].cPts.length; k++)   // transform each 3D Point
      {
        transformPoint(this.drawCmds[j].cPts[k], transMat);
      }
      // add the end point (check it exists since 'closePath' has no end point)
      if (this.drawCmds[j].ep != undefined)
      {
        transformPoint(this.drawCmds[j].ep, transMat);
      }
    }
    transformPoint(this.centroid, transMat);    // translate the centroid
    transformPoint(this.normal, transMat);    // translate the normal
    // now transform the text bounding box
    if (this.type == "TEXT")
    {
      transformPoint(this.ul, transMat);
      transformPoint(this.ur, transMat);
      transformPoint(this.ll, transMat);
      transformPoint(this.lr, transMat);
    }

    if (this.textCmds.length>0)
    {
      for(j=0; j<this.textCmds.length; j++)   // step through the draw segments
      {
        for (k=0; k<this.textCmds[j].cPts.length; k++)   // transform each 3D Point
        {
          transformPoint(this.textCmds[j].cPts[k], transMat);
        }
        // add the end point (check it exists since 'closePath' has no end point)
        if (this.textCmds[j].ep != undefined)
        {
          transformPoint(this.textCmds[j].ep, transMat);
        }
      }
    }
  }

  /*=========================================================
   * Obj3D.rotate
   * Generate a transformation matrix to rotate a 3D point
   * around the axis defined by vector vx,vy,vz by angle degs.
   * Then multiply every point in an Obj3D outline path,
   * along with the centroid and normal, by this matrix.
   * The transformed x,y,z values overwrite the current
   * values.
   *
   * This function should be used in shape
   * construction not animation. Animation doesn't change
   * x,y,z, it uses them to get tx,ty,tz.
   *---------------------------------------------------------
   */
  Obj3D.prototype.rotate = function(vx, vy, vz, angle)
  {
    var t = Math.PI/180.0;
    var mag = Math.sqrt(vx*vx + vy*vy + vz*vz);   // calc vector length
    var x	= vx/mag;
    var y	= vy/mag;
    var z	= vz/mag;
    var s	= Math.sin(-angle*t);
    var c	= Math.cos(-angle*t);
    var C	= 1-c;

    // ref: http://en.wikipedia.org/wiki/Quaternions_and_spatial_rotation
    var rotMat = [[  (x*x*C+c), (y*x*C-z*s), (z*x*C+y*s), 0],
                  [(x*y*C+z*s),   (y*y*C+c), (z*y*C-x*s), 0],
                  [(x*z*C-y*s), (y*z*C+x*s),   (z*z*C+c), 0],
                  [          0,           0,           0, 1]];
    var j, k;
    for(j=0; j < this.drawCmds.length; j++)   // step through the draw segments
    {
      for (k=0; k<this.drawCmds[j].cPts.length; k++)   // transform each 3D Point
      {
        transformPoint(this.drawCmds[j].cPts[k], rotMat);
      }
      // add the end point (check it exists since 'closePath' has no end point)
      if (this.drawCmds[j].ep != undefined)
      {
        transformPoint(this.drawCmds[j].ep, rotMat);
      }
    }
    transformPoint(this.centroid, rotMat);    // rotate the centroid
    transformPoint(this.normal, rotMat);    // rotate the normal
    // now transform the text bounding box
    if (this.type == "TEXT")
    {
      transformPoint(this.ul, rotMat);
      transformPoint(this.ur, rotMat);
      transformPoint(this.ll, rotMat);
      transformPoint(this.lr, rotMat);
    }

    if (this.textCmds.length > 0)
    {
      for(j=0; j<this.textCmds.length; j++)   // step through the draw segments
      {
        for (k=0; k<this.textCmds[j].cPts.length; k++)   // transform each 3D Point
        {
          transformPoint(this.textCmds[j].cPts[k], rotMat);
        }
        // add the end point (check it exists since 'closePath' has no end point)
        if (this.textCmds[j].ep != undefined)
        {
          transformPoint(this.textCmds[j].ep, rotMat);
        }
      }
    }
  }

  /*=========================================================
   * Obj3D.scale
   * Generate a transformation matrix to scale a 3D point
   * relative to its drawing origin.
   * Then multiply every point in an Obj3D outline path,
   * along with the centroid and normal, by this matrix.
   * The transformed x,y,z values overwrite the current
   * values.
   *
   * This function should be used in shape
   * construction not animation. Animation doesn't change
   * x,y,z, it uses them to get tx,ty,tz.
   *---------------------------------------------------------
   */
  Obj3D.prototype.scale = function(s)
  {
    var j, k;
    var sclMat = [ [s, 0, 0, 0],
                   [0, s, 0, 0],
                   [0, 0, s, 0],
                   [0, 0, 0, 1] ];

    for(j=0; j < this.drawCmds.length; j++)   // step through the draw segments
    {
      for (k=0; k<this.drawCmds[j].cPts.length; k++)   // transform each 3D Point
      {
        transformPoint(this.drawCmds[j].cPts[k], sclMat);
      }
      // add the end point (check it exists since 'closePath' has no end point)
      if (this.drawCmds[j].ep != undefined)
      {
        transformPoint(this.drawCmds[j].ep, sclMat);
      }
    }
    transformPoint(this.centroid, sclMat);    // scale the centroid
    transformPoint(this.normal, sclMat);    // translate the normal
    // now transform the text bounding box
    if (this.type == "TEXT")
    {
      transformPoint(this.ul, sclMat);
      transformPoint(this.ur, sclMat);
      transformPoint(this.ll, sclMat);
      transformPoint(this.lr, sclMat);
    }

    this.strokeWidth *= s;           // allow line width to scale with objects

    if (this.textCmds.length>0)
    {
      for(j=0; j<this.textCmds.length; j++)   // step through the draw segments
      {
        for (k=0; k<this.textCmds[j].cPts.length; k++)   // transform each 3D Point
        {
          transformPoint(this.textCmds[j].cPts[k], sclMat);
        }
        // add the end point (check it exists since 'closePath' has no end point)
        if (this.textCmds[j].ep != undefined)
        {
          transformPoint(this.textCmds[j].ep, sclMat);
        }
      }
    }
  }

  /*======================================
   * Flips the normal to point in opposite
   * direction. Useful if object coordinates
   * track CW. The normal is into screen if
   * outline is traversed CW (RH rule).
   *-------------------------------------*/
  Obj3D.prototype.flipNormal = function()
  {
    var nx = this.normal.x;
    var ny = this.normal.y;
    var nz = this.normal.z;
    this.normal.x = 2*this.centroid.x - nx;
    this.normal.y = 2*this.centroid.y - ny;
    this.normal.z = 2*this.centroid.z - nz;
  }

  Obj3D.prototype.enableDrag = function(drag)
  {
    this.dragNdrop = drag;
    // fill in the Drag3D properties for use by callBacks
    this.dragNdrop.parent = this;
    // include this in objects to be checked on mousedown
    // the Drag3D has the Cango3D context saved as 'cgo'
    drag.cgo.draggable.push(this);
  }

  Obj3D.prototype.disableDrag = function()
  {
    function getIndex(ary, obj)
    {
      for (var i=0, j=ary.length; i<j; i++)
      {
        if (ary[i] === obj) { return i; }
      }
      return -1;
    }
    if (!this.dragNdrop)
      return;
    // remove this object from array to be checked on mousedown
    // the Drag2D has the cango context saved as 'cgo'
    var aidx = getIndex(this.dragNdrop.cgo.draggable, this);
    this.dragNdrop.cgo.draggable.splice(aidx, 1);
    this.dragNdrop = null;
  }

  Obj3D.prototype.render = function(/* ... */)
  {
    var savThis = this;
    var wireframe = false;  // dont fill shapes
    var noclear = false;    // dont clear canvas before drawing
    var noraf = false;      // dont use requestAnimationFrame
    // check arguments for 'wireframe' or 'noclear'
    var args = Array.prototype.slice.call(arguments); // grab array of arguments
    for(var i = 0; i < arguments.length; i++)
    {
      if ((typeof args[i] == 'string') && (args[i].toLowerCase() == 'wireframe'))
        wireframe = true;
      if ((typeof args[i] == 'string') && (args[i].toLowerCase() == 'noclear'))
        noclear = true;
      if ((typeof args[i] == 'string')&&(args[i].toLowerCase() == 'noraf'))
        noraf = true;
    }

    if (noraf)
      this.cgo._render3D(this, wireframe, noclear);
    else
      requestAnimationFrame(function(){savThis.cgo._render3D(savThis, wireframe, noclear)});
  }

  function Group3D(cgo)
  {
    if (typeof(cgo) == 'undefined')     // this is needed to render Group3D children
      return;
    this.cgo = cgo;
    this.children = [];                 // only Group3Ds have children
    this.grpTfm = new Transform3D();    // Parent Group's current transform
    this.ofsTfm = new Transform3D();    // Group's offset from any parent Group's current transform
    this.netTfm = new Transform3D();    // product of parent Group netTfm and this.ofsTfm
    this.dirty = false;                 // render required if true
    this.centroid = new Point();
    this.drawObjs = [];
  }

  Group3D.prototype.addObj = function()
  {
    var args = Array.prototype.slice.call(arguments); // grab array of arguments
    for (var i=0; i<args.length; i++)
    {
      if (isArray(args[i]))
      {
        // check that only Group3Ds or Obj3Ds are passed
        for (var j=0; j<args[i].length; j++)
        {
          if ((typeof args[i][j].drawCmds != 'undefined')||(typeof args[i][j].children != 'undefined'))
            this.children.push(args[i][j]);
        }
      }
      else
      {
        if ((typeof args[i].drawCmds != 'undefined')||(typeof args[i].children != 'undefined'))
          this.children.push(args[i]);
      }
    }
    this.drawObjs = [];   // throw away the old array start fresh
    var xSum = 0;
    var ySum = 0;
    var zSum = 0;
    var numPts = 0;    // total point counter for all commands
    for (j=0; j<this.children.length; j++)
    {
      if (this.children[j].drawCmds != undefined)  // only Obj3D contribute
      {
        this.drawObjs.push(this.children[j]);     // just push the Obj3Ds into the array to be drawn
        // add the objects centroid to calc group centriod
        xSum += this.children[j].centroid.x;
        ySum += this.children[j].centroid.y;
        zSum += this.children[j].centroid.z;
        numPts++;
      }
    }
    if (numPts)
    {
      this.centroid.x = xSum/numPts;       // get recalculated sereval times but never if no Obj3Ds
      this.centroid.y = ySum/numPts;
      this.centroid.z = zSum/numPts;
    }
  }

  /*==================================================
   * The Transform resets this Group3D transform and
   * the effect is propagated recursively during
   * rendering.
   *-------------------------------------------------*/
  Group3D.prototype.transform = function(xfm)   // Transform3D Object
  {
    // if a new transform is passed, it becomes the Group3D ofsTfm
    if ((typeof(xfm) != 'undefined')&&(xfm != null))
      this.ofsTfm = xfm;
    // now re-calc the netTfm
    this.netTfm.matrix = matrixMultiply4x4(this.ofsTfm.matrix, this.grpTfm.matrix);
    softTransformPoint(this.centroid, this.netTfm.matrix);  // transform the centroid
  }

  /*======================================
   * Recursively apply a translation to
   * child Obj3Ds or children of Group3Ds
   * This is a permanent change to
   * do not use for animation, use
   * transform method instead.
   *-------------------------------------*/
  Group3D.prototype.translate = function(x, y, z)
  {
    function applyXfm(obj)
    {
      // do nothing if array elements are not Obj3Ds
      if (typeof(obj.drawCmds) == 'undefined')
        return;
      obj.translate(x, y, z);
    }
    // task:function, grp: group with children
  	function iterate(task, grp)
  	{
  		for (var x=0; x<grp.children.length; x++)
  		{
  			var childNode = grp.children[x];
   			task(childNode);
  			if ((childNode.children != undefined) && (childNode.children.length > 0))
  				iterate(task, childNode);
  		}
  	};

    // group only has children to tend
    iterate(applyXfm, this);

    // now transform the centroid
    var xVal = x || 0;
    var yVal = y || 0;
    var zVal = z || 0;
    var transMat = [ [   1,    0,    0, 0],
                     [   0,    1,    0, 0],
                     [   0,    0,    1, 0],
                     [xVal, yVal, zVal, 1] ];
    transformPoint(this.centroid, transMat);    // translate the centroid
  }

  /*======================================
   * Recursively apply the rotation to
   * children or children of children
   * This is a permanent change to
   * do not use for animation, use
   * transform method instead.
   *-------------------------------------*/
  Group3D.prototype.rotate = function(vx, vy, vz, angle)
  {
    function applyXfm(obj)
    {
      // do nothing if array elements are not Obj3Ds
      if (typeof(obj.drawCmds) == 'undefined')
        return;
      obj.rotate(vx, vy, vz, angle);
    }
    // task:function, grp: group with children
  	function iterate(task, grp)
  	{
  		for(var x=0; x<grp.children.length; x++)
  		{
  			var childNode = grp.children[x];
 			  task(childNode);
  			if ((childNode.children != undefined) && (childNode.children.length > 0))
  				iterate(task, childNode);
  		}
  	};

    // group only has children to tend
    iterate(applyXfm, this);

    var t = Math.PI/180.0;
    var mag = Math.sqrt(vx*vx + vy*vy + vz*vz);   // calc vector length
    var x	= vx/mag;
    var y	= vy/mag;
    var z	= vz/mag;
    var s	= Math.sin(-angle*t);
    var c	= Math.cos(-angle*t);
    var C	= 1-c;

    // ref: http://en.wikipedia.org/wiki/Quaternions_and_spatial_rotation
    var rotMat = [[  (x*x*C+c), (y*x*C-z*s), (z*x*C+y*s), 0],
                  [(x*y*C+z*s),   (y*y*C+c), (z*y*C-x*s), 0],
                  [(x*z*C-y*s), (y*z*C+x*s),   (z*z*C+c), 0],
                  [          0,           0,           0, 1]];
    transformPoint(this.centroid, rotMat);    // rotate the centroid
  }

  /*======================================
   * Recursively apply the scaling to
   * children or children of children
   * This is a permanent change to
   * do not use for animation, use
   * transform method instead.
   *-------------------------------------*/
  Group3D.prototype.scale = function(s)
  {
    function applyXfm(obj)
    {
      // do nothing if array elements are not Obj3Ds
      if (typeof(obj.drawCmds) == 'undefined')
        return;
      obj.scale(s);
    }
    // task:function, grp: group with children
  	function iterate(task, grp)
  	{
  		for(var x=0; x<grp.children.length; x++)
  		{
  			var childNode = grp.children[x];
   			task(childNode);
  			if ((childNode.children != undefined) && (childNode.children.length > 0))
  				iterate(task, childNode);
  		}
  	};

    // group only has children to tend
    iterate(applyXfm, this);

    var sclMat = [ [s, 0, 0, 0],
                   [0, s, 0, 0],
                   [0, 0, s, 0],
                   [0, 0, 0, 1] ];
    transformPoint(this.centroid, sclMat);    // scale the centroid
  }

  /*======================================
   * Recursively enable dragging on
   * Obj3D children
   *-------------------------------------*/
  Group3D.prototype.enableDrag = function(drag)
  {
    function enableObjDrag(obj)
    {
      // do nothing if array elements are not Obj3Ds
      if (typeof(obj.drawCmds) == 'undefined')    // must be a group so continue
        return;
      obj.enableDrag(drag);    // obj is an Obj3D so enable it
    }
    // task:function, grp: group with children
    function iterate(task, grp)
    {
      for(var x=0; x<grp.children.length; x++)
      {
        var childNode = grp.children[x];
        task(childNode);
        if ((childNode.children != undefined) && (childNode.children.length > 0))
          iterate(task, childNode);
  		}
  	};

    // group only has children to tend
    iterate(enableObjDrag, this);
  }

  /*======================================
   * Recursively disable dragging to
   * Obj3D children
   *-------------------------------------*/
  Group3D.prototype.disableDrag = function(drag)
  {
    function disableObjDrag(obj)
    {
      // do nothing if array elements are not Obj3Ds
      if (typeof(obj.drawCmds) == 'undefined')
        return;
      obj.disableDrag(drag);
    }
    // task:function, grp: group with children
    function iterate(task, grp)
    {
      for(var x=0; x<grp.children.length; x++)
      {
        var childNode = grp.children[x];
        task(childNode);
        if ((childNode.children != undefined) && (childNode.children.length > 0))
          iterate(task, childNode);
      }
  	};

    // group only has children to tend
    iterate(disableObjDrag, this);
  }

  /*======================================
   * If cgo._render3D is not busy, call it.
   * This method is designed to return
   * immediately as it will usually
   * be called in an event handler
   *-------------------------------------*/
  Group3D.prototype.render = function(/* ... */)
  {
    var savThis = this;
    var wireframe = false;  // dont fill shapes
    var noclear = false;    // dont clear canvas before drawing
    var noraf = false;      // dont use requestAnimationFrame
    // check arguments for 'wireframe' or 'noclear'
    var args = Array.prototype.slice.call(arguments); // grab array of arguments
    for(var i = 0; i < arguments.length; i++)
    {
      if ((typeof args[i] == 'string')&&(args[i].toLowerCase() == 'wireframe'))
        wireframe = true;
      if ((typeof args[i] == 'string')&&(args[i].toLowerCase() == 'noclear'))
        noclear = true;
      if ((typeof args[i] == 'string')&&(args[i].toLowerCase() == 'noraf'))
        noraf = true;
    }

    this.dirty = true;   // flag a new request if busy it will be done when not busy
    if (this.cgo.reBusy)
      return;     // _render3D is busy, the dirty flag will show request has been made
    if (noraf)
      this.cgo._render3D(this, wireframe, noclear);
    else
      requestAnimationFrame(function(){savThis.cgo._render3D(savThis, wireframe, noclear)});
  }

  function Drag3D(cangoGC, grabFn, dragFn, dropFn)
  {
    var savThis = this;

    this.cgo = cangoGC;
    this.parent = null;
    this.grabCallback = grabFn || null;
    this.dragCallback = dragFn || null;
    this.dropCallback = dropFn || null;
    this.dwgOrg = {x:0, y:0, z:0};      // parent drawing origin in world coords
    this.dwgOrgPx = {x:0, y:0, z:0};    // parent drawing origin in pixels
    this.netTfm = function(){return savThis.parent.netTfm};    // make a pointer by using a closure
    this.xGrabOfs = 0;    // csr offset (pxls) from 2D projected drawing origin, filled in at grab time
    this.yGrabOfs = 0;

    // these closures are called in the scope of the Drag3D instance so 'this' is valid
    this.grab = function(e)
    {
      var e = e||window.event;
      this.cgo.cnvs.onmouseup = function(e){savThis.drop(e)};    // create a closure
      var csrPos = this.cgo._getCursorPos(e);      // update mouse pos to pass to the owner
      // save the cursor offset from the drawing origin
      this.xGrabOfs = csrPos.x - this.dwgOrgPx.x;
      this.yGrabOfs = csrPos.y - this.dwgOrgPx.y;

      if (this.grabCallback)
        this.grabCallback(csrPos);    // call in the scope of dragNdrop object

      this.cgo.cnvs.onmousemove = function(e){savThis.drag(e)};  // create a closure

      if (e.preventDefault)       // prevent default browser action (W3C)
        e.preventDefault();
      else                        // shortcut for stopping the browser action in IE
        window.event.returnValue = false;

      return false;
    };

    this.drag = function(e)
    {
      var csrPos = this.cgo._getCursorPos(e);  // update mouse pos to pass to the owner
      if (this.dragCallback)
        this.dragCallback(csrPos);

      return false;
    };

    this.drop = function(e)
    {
      var csrPos = this.cgo._getCursorPos(e);  // update mouse pos to pass to the owner
      this.cgo.cnvs.onmouseup = null;
      this.cgo.cnvs.onmousemove = null;
      if (this.dropCallback)
        this.dropCallback(csrPos);
    }
  }

  /* ====================================================================
   * A 3d coordinate (right handed system)
   *
   * X +ve right
   * Y +ve up
   * Z +ve out screen
   * --------------------------------------------------------------------
   */
  function Point(x, y, z)
  {
    this.x = x || 0;
    this.y = y || 0;
    this.z = z || 0;

    // Translated, rotated, scaled
    this.tx = this.x;
    this.ty = this.y;
    this.tz = this.z;

    // tx, ty, tz, projected to 2D as seen from viewpoint
    this.fx;
    this.fy;
  }

  /* ===============================================
   * Object holding an array of 4 1x4 arrays,
   * representing a 4x4 matrix
   * -----------------------------------------------
   */
  function Transform3D(matrixAry)
  {
    if (typeof matrixAry != 'undefined')
      this.matrix = matrixAry;
    else
      this.matrix = [ [1, 0, 0, 0],
                      [0, 1, 0, 0],
                      [0, 0, 1, 0],
                      [0, 0, 0, 1] ];
  }

  // Rotate matrix, pass unit vector along rotation axis, angle in degrees
  Transform3D.prototype.rotate = function(vx, vy, vz, angle)
  {
    var t = Math.PI/180.0;
    var mag = Math.sqrt(vx*vx + vy*vy + vz*vz);   // calc vector length
    var x	= vx/mag;
    var y	= vy/mag;
    var z	= vz/mag;
    var s	= Math.sin(-angle*t);
    var c	= Math.cos(-angle*t);
    var C	= 1-c;
    // ref: http://en.wikipedia.org/wiki/Quaternions_and_spatial_rotation
    var rot = [
                [  (x*x*C+c), (y*x*C-z*s), (z*x*C+y*s), 0],
                [(x*y*C+z*s),   (y*y*C+c), (z*y*C-x*s), 0],
                [(x*z*C-y*s), (y*z*C+x*s),   (z*z*C+c), 0],
                [          0,           0,           0, 1]
              ];
    this.matrix = matrixMultiply4x4(this.matrix, rot);
  }

  // Apply a translation to current transformation matrix
  Transform3D.prototype.translate = function(x, y, z)
  {
    var trns = [ [1, 0, 0, 0],
                 [0, 1, 0, 0],
                 [0, 0, 1, 0],
                 [x, y, z, 1] ];
    this.matrix = matrixMultiply4x4(this.matrix, trns);
  }

  // Apply a scale to current transformation matrix
  Transform3D.prototype.scale = function(s)
  {
    var as = Math.abs(s);
    var scl = [[as, 0,  0, 0],
               [0, as,  0, 0],
               [0,  0, as, 0],
               [0,  0,  0, 1]];
    this.matrix = matrixMultiply4x4(this.matrix, scl);
  }

  Transform3D.prototype.identityMatrix = function ()
  {
    return [[1, 0, 0, 0],
            [0, 1, 0, 0],
            [0, 0, 1, 0],
            [0, 0, 0, 1]];
  }

  // ============ useful objects for animation, these are returned by 3D path functions ============

  var CanvasTextFunctions = { };
  //
  // This code is released to the public domain by Jim Studt, 2007.
  // He may keep some sort of up to date copy at http://www.federated.com/~jim/canvastext/
  //

  CanvasTextFunctions.letters = {
      ' ': { width: 16, points: [] },
      '!': { width: 10, points: [[5,21],[5,7],[-1,-1],[5,2],[4,1],[5,0],[6,1],[5,2]] },
      '"': { width: 16, points: [[4,21],[4,14],[-1,-1],[12,21],[12,14]] },
      '#': { width: 21, points: [[11,25],[4,-7],[-1,-1],[17,25],[10,-7],[-1,-1],[4,12],[18,12],[-1,-1],[3,6],[17,6]] },
      '$': { width: 20, points: [[8,25],[8,-4],[-1,-1],[12,25],[12,-4],[-1,-1],[17,18],[15,20],[12,21],[8,21],[5,20],[3,18],[3,16],[4,14],[5,13],[7,12],[13,10],[15,9],[16,8],[17,6],[17,3],[15,1],[12,0],[8,0],[5,1],[3,3]] },
      '%': { width: 24, points: [[21,21],[3,0],[-1,-1],[8,21],[10,19],[10,17],[9,15],[7,14],[5,14],[3,16],[3,18],[4,20],[6,21],[8,21],[10,20],[13,19],[16,19],[19,20],[21,21],[-1,-1],[17,7],[15,6],[14,4],[14,2],[16,0],[18,0],[20,1],[21,3],[21,5],[19,7],[17,7]] },
      '&': { width: 26, points: [[23,12],[23,13],[22,14],[21,14],[20,13],[19,11],[17,6],[15,3],[13,1],[11,0],[7,0],[5,1],[4,2],[3,4],[3,6],[4,8],[5,9],[12,13],[13,14],[14,16],[14,18],[13,20],[11,21],[9,20],[8,18],[8,16],[9,13],[11,10],[16,3],[18,1],[20,0],[22,0],[23,1],[23,2]] },
      '\'': { width: 10, points: [[5,19],[4,20],[5,21],[6,20],[6,18],[5,16],[4,15]] },
      '(': { width: 14, points: [[11,25],[9,23],[7,20],[5,16],[4,11],[4,7],[5,2],[7,-2],[9,-5],[11,-7]] },
      ')': { width: 14, points: [[3,25],[5,23],[7,20],[9,16],[10,11],[10,7],[9,2],[7,-2],[5,-5],[3,-7]] },
      '*': { width: 16, points: [[8,21],[8,9],[-1,-1],[3,18],[13,12],[-1,-1],[13,18],[3,12]] },
      '+': { width: 26, points: [[13,18],[13,0],[-1,-1],[4,9],[22,9]] },
      ',': { width: 10, points: [[6,1],[5,0],[4,1],[5,2],[6,1],[6,-1],[5,-3],[4,-4]] },
      '-': { width: 26, points: [[4,9],[22,9]] },
      '.': { width: 10, points: [[5,2],[4,1],[5,0],[6,1],[5,2]] },
      '/': { width: 22, points: [[20,25],[2,-7]] },
      '0': { width: 20, points: [[9,21],[6,20],[4,17],[3,12],[3,9],[4,4],[6,1],[9,0],[11,0],[14,1],[16,4],[17,9],[17,12],[16,17],[14,20],[11,21],[9,21]] },
      '1': { width: 20, points: [[6,17],[8,18],[11,21],[11,0]] },
      '2': { width: 20, points: [[4,16],[4,17],[5,19],[6,20],[8,21],[12,21],[14,20],[15,19],[16,17],[16,15],[15,13],[13,10],[3,0],[17,0]] },
      '3': { width: 20, points: [[5,21],[16,21],[10,13],[13,13],[15,12],[16,11],[17,8],[17,6],[16,3],[14,1],[11,0],[8,0],[5,1],[4,2],[3,4]] },
      '4': { width: 20, points: [[13,21],[3,7],[18,7],[-1,-1],[13,21],[13,0]] },
      '5': { width: 20, points: [[15,21],[5,21],[4,12],[5,13],[8,14],[11,14],[14,13],[16,11],[17,8],[17,6],[16,3],[14,1],[11,0],[8,0],[5,1],[4,2],[3,4]] },
      '6': { width: 20, points: [[16,18],[15,20],[12,21],[10,21],[7,20],[5,17],[4,12],[4,7],[5,3],[7,1],[10,0],[11,0],[14,1],[16,3],[17,6],[17,7],[16,10],[14,12],[11,13],[10,13],[7,12],[5,10],[4,7]] },
      '7': { width: 20, points: [[17,21],[7,0],[-1,-1],[3,21],[17,21]] },
      '8': { width: 20, points: [[8,21],[5,20],[4,18],[4,16],[5,14],[7,13],[11,12],[14,11],[16,9],[17,7],[17,4],[16,2],[15,1],[12,0],[8,0],[5,1],[4,2],[3,4],[3,7],[4,9],[6,11],[9,12],[13,13],[15,14],[16,16],[16,18],[15,20],[12,21],[8,21]] },
      '9': { width: 20, points: [[16,14],[15,11],[13,9],[10,8],[9,8],[6,9],[4,11],[3,14],[3,15],[4,18],[6,20],[9,21],[10,21],[13,20],[15,18],[16,14],[16,9],[15,4],[13,1],[10,0],[8,0],[5,1],[4,3]] },
      ':': { width: 10, points: [[5,14],[4,13],[5,12],[6,13],[5,14],[-1,-1],[5,2],[4,1],[5,0],[6,1],[5,2]] },
      ';': { width: 10, points: [[5,14],[4,13],[5,12],[6,13],[5,14],[-1,-1],[6,1],[5,0],[4,1],[5,2],[6,1],[6,-1],[5,-3],[4,-4]] },
      '<': { width: 24, points: [[20,18],[4,9],[20,0]] },
      '=': { width: 26, points: [[4,12],[22,12],[-1,-1],[4,6],[22,6]] },
      '>': { width: 24, points: [[4,18],[20,9],[4,0]] },
      '?': { width: 18, points: [[3,16],[3,17],[4,19],[5,20],[7,21],[11,21],[13,20],[14,19],[15,17],[15,15],[14,13],[13,12],[9,10],[9,7],[-1,-1],[9,2],[8,1],[9,0],[10,1],[9,2]] },
      '@': { width: 27, points: [[18,13],[17,15],[15,16],[12,16],[10,15],[9,14],[8,11],[8,8],[9,6],[11,5],[14,5],[16,6],[17,8],[-1,-1],[12,16],[10,14],[9,11],[9,8],[10,6],[11,5],[-1,-1],[18,16],[17,8],[17,6],[19,5],[21,5],[23,7],[24,10],[24,12],[23,15],[22,17],[20,19],[18,20],[15,21],[12,21],[9,20],[7,19],[5,17],[4,15],[3,12],[3,9],[4,6],[5,4],[7,2],[9,1],[12,0],[15,0],[18,1],[20,2],[21,3],[-1,-1],[19,16],[18,8],[18,6],[19,5]] },
      'A': { width: 18, points: [[9,21],[1,0],[-1,-1],[9,21],[17,0],[-1,-1],[4,7],[14,7]] },
      'B': { width: 21, points: [[4,21],[4,0],[-1,-1],[4,21],[13,21],[16,20],[17,19],[18,17],[18,15],[17,13],[16,12],[13,11],[-1,-1],[4,11],[13,11],[16,10],[17,9],[18,7],[18,4],[17,2],[16,1],[13,0],[4,0]] },
      'C': { width: 21, points: [[18,16],[17,18],[15,20],[13,21],[9,21],[7,20],[5,18],[4,16],[3,13],[3,8],[4,5],[5,3],[7,1],[9,0],[13,0],[15,1],[17,3],[18,5]] },
      'D': { width: 21, points: [[4,21],[4,0],[-1,-1],[4,21],[11,21],[14,20],[16,18],[17,16],[18,13],[18,8],[17,5],[16,3],[14,1],[11,0],[4,0]] },
      'E': { width: 19, points: [[4,21],[4,0],[-1,-1],[4,21],[17,21],[-1,-1],[4,11],[12,11],[-1,-1],[4,0],[17,0]] },
      'F': { width: 18, points: [[4,21],[4,0],[-1,-1],[4,21],[17,21],[-1,-1],[4,11],[12,11]] },
      'G': { width: 21, points: [[18,16],[17,18],[15,20],[13,21],[9,21],[7,20],[5,18],[4,16],[3,13],[3,8],[4,5],[5,3],[7,1],[9,0],[13,0],[15,1],[17,3],[18,5],[18,8],[-1,-1],[13,8],[18,8]] },
      'H': { width: 22, points: [[4,21],[4,0],[-1,-1],[18,21],[18,0],[-1,-1],[4,11],[18,11]] },
      'I': { width: 8, points: [[4,21],[4,0]] },
      'J': { width: 16, points: [[12,21],[12,5],[11,2],[10,1],[8,0],[6,0],[4,1],[3,2],[2,5],[2,7]] },
      'K': { width: 21, points: [[4,21],[4,0],[-1,-1],[18,21],[4,7],[-1,-1],[9,12],[18,0]] },
      'L': { width: 17, points: [[4,21],[4,0],[-1,-1],[4,0],[16,0]] },
      'M': { width: 24, points: [[4,21],[4,0],[-1,-1],[4,21],[12,0],[-1,-1],[20,21],[12,0],[-1,-1],[20,21],[20,0]] },
      'N': { width: 22, points: [[4,21],[4,0],[-1,-1],[4,21],[18,0],[-1,-1],[18,21],[18,0]] },
      'O': { width: 22, points: [[9,21],[7,20],[5,18],[4,16],[3,13],[3,8],[4,5],[5,3],[7,1],[9,0],[13,0],[15,1],[17,3],[18,5],[19,8],[19,13],[18,16],[17,18],[15,20],[13,21],[9,21]] },
      'P': { width: 21, points: [[4,21],[4,0],[-1,-1],[4,21],[13,21],[16,20],[17,19],[18,17],[18,14],[17,12],[16,11],[13,10],[4,10]] },
      'Q': { width: 22, points: [[9,21],[7,20],[5,18],[4,16],[3,13],[3,8],[4,5],[5,3],[7,1],[9,0],[13,0],[15,1],[17,3],[18,5],[19,8],[19,13],[18,16],[17,18],[15,20],[13,21],[9,21],[-1,-1],[12,4],[18,-2]] },
      'R': { width: 21, points: [[4,21],[4,0],[-1,-1],[4,21],[13,21],[16,20],[17,19],[18,17],[18,15],[17,13],[16,12],[13,11],[4,11],[-1,-1],[11,11],[18,0]] },
      'S': { width: 20, points: [[17,18],[15,20],[12,21],[8,21],[5,20],[3,18],[3,16],[4,14],[5,13],[7,12],[13,10],[15,9],[16,8],[17,6],[17,3],[15,1],[12,0],[8,0],[5,1],[3,3]] },
      'T': { width: 16, points: [[8,21],[8,0],[-1,-1],[1,21],[15,21]] },
      'U': { width: 22, points: [[4,21],[4,6],[5,3],[7,1],[10,0],[12,0],[15,1],[17,3],[18,6],[18,21]] },
      'V': { width: 18, points: [[1,21],[9,0],[-1,-1],[17,21],[9,0]] },
      'W': { width: 24, points: [[2,21],[7,0],[-1,-1],[12,21],[7,0],[-1,-1],[12,21],[17,0],[-1,-1],[22,21],[17,0]] },
      'X': { width: 20, points: [[3,21],[17,0],[-1,-1],[17,21],[3,0]] },
      'Y': { width: 18, points: [[1,21],[9,11],[9,0],[-1,-1],[17,21],[9,11]] },
      'Z': { width: 20, points: [[17,21],[3,0],[-1,-1],[3,21],[17,21],[-1,-1],[3,0],[17,0]] },
      '[': { width: 14, points: [[4,25],[4,-7],[-1,-1],[5,25],[5,-7],[-1,-1],[4,25],[11,25],[-1,-1],[4,-7],[11,-7]] },
      '\\': { width: 14, points: [[0,21],[14,-3]] },
      ']': { width: 14, points: [[9,25],[9,-7],[-1,-1],[10,25],[10,-7],[-1,-1],[3,25],[10,25],[-1,-1],[3,-7],[10,-7]] },
      '^': { width: 16, points: [[6,15],[8,18],[10,15],[-1,-1],[3,12],[8,17],[13,12],[-1,-1],[8,17],[8,0]] },
      '_': { width: 16, points: [[0,-2],[16,-2]] },
      '`': { width: 10, points: [[6,21],[5,20],[4,18],[4,16],[5,15],[6,16],[5,17]] },
      'a': { width: 19, points: [[15,14],[15,0],[-1,-1],[15,11],[13,13],[11,14],[8,14],[6,13],[4,11],[3,8],[3,6],[4,3],[6,1],[8,0],[11,0],[13,1],[15,3]] },
      'b': { width: 19, points: [[4,21],[4,0],[-1,-1],[4,11],[6,13],[8,14],[11,14],[13,13],[15,11],[16,8],[16,6],[15,3],[13,1],[11,0],[8,0],[6,1],[4,3]] },
      'c': { width: 18, points: [[15,11],[13,13],[11,14],[8,14],[6,13],[4,11],[3,8],[3,6],[4,3],[6,1],[8,0],[11,0],[13,1],[15,3]] },
      'd': { width: 19, points: [[15,21],[15,0],[-1,-1],[15,11],[13,13],[11,14],[8,14],[6,13],[4,11],[3,8],[3,6],[4,3],[6,1],[8,0],[11,0],[13,1],[15,3]] },
      'e': { width: 18, points: [[3,8],[15,8],[15,10],[14,12],[13,13],[11,14],[8,14],[6,13],[4,11],[3,8],[3,6],[4,3],[6,1],[8,0],[11,0],[13,1],[15,3]] },
      'f': { width: 12, points: [[10,21],[8,21],[6,20],[5,17],[5,0],[-1,-1],[2,14],[9,14]] },
      'g': { width: 19, points: [[15,14],[15,-2],[14,-5],[13,-6],[11,-7],[8,-7],[6,-6],[-1,-1],[15,11],[13,13],[11,14],[8,14],[6,13],[4,11],[3,8],[3,6],[4,3],[6,1],[8,0],[11,0],[13,1],[15,3]] },
      'h': { width: 19, points: [[4,21],[4,0],[-1,-1],[4,10],[7,13],[9,14],[12,14],[14,13],[15,10],[15,0]] },
      'i': { width: 8, points: [[3,21],[4,20],[5,21],[4,22],[3,21],[-1,-1],[4,14],[4,0]] },
      'j': { width: 10, points: [[5,21],[6,20],[7,21],[6,22],[5,21],[-1,-1],[6,14],[6,-3],[5,-6],[3,-7],[1,-7]] },
      'k': { width: 17, points: [[4,21],[4,0],[-1,-1],[14,14],[4,4],[-1,-1],[8,8],[15,0]] },
      'l': { width: 8, points: [[4,21],[4,0]] },
      'm': { width: 30, points: [[4,14],[4,0],[-1,-1],[4,10],[7,13],[9,14],[12,14],[14,13],[15,10],[15,0],[-1,-1],[15,10],[18,13],[20,14],[23,14],[25,13],[26,10],[26,0]] },
      'n': { width: 19, points: [[4,14],[4,0],[-1,-1],[4,10],[7,13],[9,14],[12,14],[14,13],[15,10],[15,0]] },
      'o': { width: 19, points: [[8,14],[6,13],[4,11],[3,8],[3,6],[4,3],[6,1],[8,0],[11,0],[13,1],[15,3],[16,6],[16,8],[15,11],[13,13],[11,14],[8,14]] },
      'p': { width: 19, points: [[4,14],[4,-7],[-1,-1],[4,11],[6,13],[8,14],[11,14],[13,13],[15,11],[16,8],[16,6],[15,3],[13,1],[11,0],[8,0],[6,1],[4,3]] },
      'q': { width: 19, points: [[15,14],[15,-7],[-1,-1],[15,11],[13,13],[11,14],[8,14],[6,13],[4,11],[3,8],[3,6],[4,3],[6,1],[8,0],[11,0],[13,1],[15,3]] },
      'r': { width: 13, points: [[4,14],[4,0],[-1,-1],[4,8],[5,11],[7,13],[9,14],[12,14]] },
      's': { width: 17, points: [[14,11],[13,13],[10,14],[7,14],[4,13],[3,11],[4,9],[6,8],[11,7],[13,6],[14,4],[14,3],[13,1],[10,0],[7,0],[4,1],[3,3]] },
      't': { width: 12, points: [[5,21],[5,4],[6,1],[8,0],[10,0],[-1,-1],[2,14],[9,14]] },
      'u': { width: 19, points: [[4,14],[4,4],[5,1],[7,0],[10,0],[12,1],[15,4],[-1,-1],[15,14],[15,0]] },
      'v': { width: 16, points: [[2,14],[8,0],[-1,-1],[14,14],[8,0]] },
      'w': { width: 22, points: [[3,14],[7,0],[-1,-1],[11,14],[7,0],[-1,-1],[11,14],[15,0],[-1,-1],[19,14],[15,0]] },
      'x': { width: 17, points: [[3,14],[14,0],[-1,-1],[14,14],[3,0]] },
      'y': { width: 16, points: [[2,14],[8,0],[-1,-1],[14,14],[8,0],[6,-4],[4,-6],[2,-7],[1,-7]] },
      'z': { width: 17, points: [[14,14],[3,0],[-1,-1],[3,14],[14,14],[-1,-1],[3,0],[14,0]] },
      '{': { width: 14, points: [[9,25],[7,24],[6,23],[5,21],[5,19],[6,17],[7,16],[8,14],[8,12],[6,10],[-1,-1],[7,24],[6,22],[6,20],[7,18],[8,17],[9,15],[9,13],[8,11],[4,9],[8,7],[9,5],[9,3],[8,1],[7,0],[6,-2],[6,-4],[7,-6],[-1,-1],[6,8],[8,6],[8,4],[7,2],[6,1],[5,-1],[5,-3],[6,-5],[7,-6],[9,-7]] },
      '|': { width: 8, points: [[4,25],[4,-7]] },
      '}': { width: 14, points: [[5,25],[7,24],[8,23],[9,21],[9,19],[8,17],[7,16],[6,14],[6,12],[8,10],[-1,-1],[7,24],[8,22],[8,20],[7,18],[6,17],[5,15],[5,13],[6,11],[10,9],[6,7],[5,5],[5,3],[6,1],[7,0],[8,-2],[8,-4],[7,-6],[-1,-1],[8,8],[6,6],[6,4],[7,2],[8,1],[9,-1],[9,-3],[8,-5],[7,-6],[5,-7]] },
      '~': { width: 24, points: [[3,6],[3,8],[4,11],[6,12],[8,12],[10,11],[14,8],[16,7],[18,7],[20,8],[21,10],[-1,-1],[3,8],[4,10],[6,11],[8,11],[10,10],[14,7],[16,6],[18,6],[20,7],[21,10],[21,12]] }
  };

  CanvasTextFunctions.letter = function(ch)
  {
    return CanvasTextFunctions.letters[ch];
  }

  CanvasTextFunctions.ascent = function(font, size)
  {
    return size;
  }

  CanvasTextFunctions.descent = function(font, size)
  {
    return 7.0*size/25.0;
  }

  CanvasTextFunctions.measure = function(font, size, str)
  {
    var total = 0;
    var len = str.length;

    for (var i = 0; i < len; i++)
    {
    	var c = CanvasTextFunctions.letter(str.charAt(i));
    	if (c)
        total += c.width * size / 25.0;
    }

    return total;
  }

  CanvasTextFunctions.draw = function(ctx, font, size, x, y, str)
  {
    var total = 0;
    var len = str.length;
    var mag = size / 25.0;

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineWidth = 2.0 * mag;

    for (var i = 0; i < len; i++)
    {
    	var c = CanvasTextFunctions.letter(str.charAt(i));
    	if (!c) continue;

    	ctx.beginPath();

    	var penUp = 1;
    	var needStroke = 0;
    	for (var j = 0; j < c.points.length; j++)
      {
    	  var a = c.points[j];
    	  if (a[0] == -1 && a[1] == -1)
        {
      		penUp = 1;
      		continue;
    	  }
    	  if (penUp)
        {
      		ctx.moveTo(x + a[0]*mag, y - a[1]*mag);
      		penUp = false;
    	  }
        else
        {
    		  ctx.lineTo(x + a[0]*mag, y - a[1]*mag);
    	  }
    	}
    	ctx.stroke();
    	x += c.width*mag;
    }
    ctx.restore();
    return total;
  }

// simple add event handler that gets the handlers called in the sequene that they were set
  function addLoadEvent(obj, func)
  {
  	var oldonload = obj.onload;

  	if (typeof obj.onload != 'function')
      obj.onload = func;
  	else
    	obj.onload = function(){oldonload();	func();}
  }

  /**
   * A class to parse color values
   * @author Stoyan Stefanov <sstoo@gmail.com>
   * @link   http://www.phpied.com/rgb-color-parser-in-javascript/
   * @license Use it if you like it
   *
   * supplemented to handle rgba format (alpha 0 .. 1.0)  by arc 04SEP09
   */
  function RGBAColor(color_string)
  {
    this.ok = false;

    if (typeof color_string != "string")       // bugfix: crashed if passed a number. arc
      return;

    // strip any leading #
    if (color_string.charAt(0) == '#')
    { // remove # if any
      color_string = color_string.substr(1,6);
    }

    color_string = color_string.replace(/ /g,'');
    color_string = color_string.toLowerCase();

    // before getting into regexps, try simple matches
    // and overwrite the input
    var simple_colors = {
        aliceblue: 'f0f8ff',
        antiquewhite: 'faebd7',
        aqua: '00ffff',
        aquamarine: '7fffd4',
        azure: 'f0ffff',
        beige: 'f5f5dc',
        bisque: 'ffe4c4',
        black: '000000',
        blanchedalmond: 'ffebcd',
        blue: '0000ff',
        blueviolet: '8a2be2',
        brown: 'a52a2a',
        burlywood: 'deb887',
        cadetblue: '5f9ea0',
        chartreuse: '7fff00',
        chocolate: 'd2691e',
        coral: 'ff7f50',
        cornflowerblue: '6495ed',
        cornsilk: 'fff8dc',
        crimson: 'dc143c',
        cyan: '00ffff',
        darkblue: '00008b',
        darkcyan: '008b8b',
        darkgoldenrod: 'b8860b',
        darkgray: 'a9a9a9',
        darkgreen: '006400',
        darkkhaki: 'bdb76b',
        darkmagenta: '8b008b',
        darkolivegreen: '556b2f',
        darkorange: 'ff8c00',
        darkorchid: '9932cc',
        darkred: '8b0000',
        darksalmon: 'e9967a',
        darkseagreen: '8fbc8f',
        darkslateblue: '483d8b',
        darkslategray: '2f4f4f',
        darkturquoise: '00ced1',
        darkviolet: '9400d3',
        deeppink: 'ff1493',
        deepskyblue: '00bfff',
        dimgray: '696969',
        dodgerblue: '1e90ff',
        feldspar: 'd19275',
        firebrick: 'b22222',
        floralwhite: 'fffaf0',
        forestgreen: '228b22',
        fuchsia: 'ff00ff',
        gainsboro: 'dcdcdc',
        ghostwhite: 'f8f8ff',
        gold: 'ffd700',
        goldenrod: 'daa520',
        gray: '808080',
        green: '008000',
        greenyellow: 'adff2f',
        honeydew: 'f0fff0',
        hotpink: 'ff69b4',
        indianred : 'cd5c5c',
        indigo : '4b0082',
        ivory: 'fffff0',
        khaki: 'f0e68c',
        lavender: 'e6e6fa',
        lavenderblush: 'fff0f5',
        lawngreen: '7cfc00',
        lemonchiffon: 'fffacd',
        lightblue: 'add8e6',
        lightcoral: 'f08080',
        lightcyan: 'e0ffff',
        lightgoldenrodyellow: 'fafad2',
        lightgrey: 'd3d3d3',
        lightgreen: '90ee90',
        lightpink: 'ffb6c1',
        lightsalmon: 'ffa07a',
        lightseagreen: '20b2aa',
        lightskyblue: '87cefa',
        lightslateblue: '8470ff',
        lightslategray: '778899',
        lightsteelblue: 'b0c4de',
        lightyellow: 'ffffe0',
        lime: '00ff00',
        limegreen: '32cd32',
        linen: 'faf0e6',
        magenta: 'ff00ff',
        maroon: '800000',
        mediumaquamarine: '66cdaa',
        mediumblue: '0000cd',
        mediumorchid: 'ba55d3',
        mediumpurple: '9370d8',
        mediumseagreen: '3cb371',
        mediumslateblue: '7b68ee',
        mediumspringgreen: '00fa9a',
        mediumturquoise: '48d1cc',
        mediumvioletred: 'c71585',
        midnightblue: '191970',
        mintcream: 'f5fffa',
        mistyrose: 'ffe4e1',
        moccasin: 'ffe4b5',
        navajowhite: 'ffdead',
        navy: '000080',
        oldlace: 'fdf5e6',
        olive: '808000',
        olivedrab: '6b8e23',
        orange: 'ffa500',
        orangered: 'ff4500',
        orchid: 'da70d6',
        palegoldenrod: 'eee8aa',
        palegreen: '98fb98',
        paleturquoise: 'afeeee',
        palevioletred: 'd87093',
        papayawhip: 'ffefd5',
        peachpuff: 'ffdab9',
        peru: 'cd853f',
        pink: 'ffc0cb',
        plum: 'dda0dd',
        powderblue: 'b0e0e6',
        purple: '800080',
        red: 'ff0000',
        rosybrown: 'bc8f8f',
        royalblue: '4169e1',
        saddlebrown: '8b4513',
        salmon: 'fa8072',
        sandybrown: 'f4a460',
        seagreen: '2e8b57',
        seashell: 'fff5ee',
        sienna: 'a0522d',
        silver: 'c0c0c0',
        skyblue: '87ceeb',
        slateblue: '6a5acd',
        slategray: '708090',
        snow: 'fffafa',
        springgreen: '00ff7f',
        steelblue: '4682b4',
        tan: 'd2b48c',
        teal: '008080',
        thistle: 'd8bfd8',
        tomato: 'ff6347',
        transparent: 'rgba(0,0,0,0)',
        turquoise: '40e0d0',
        violet: 'ee82ee',
        violetred: 'd02090',
        wheat: 'f5deb3',
        white: 'ffffff',
        whitesmoke: 'f5f5f5',
        yellow: 'ffff00',
        yellowgreen: '9acd32'
    };
    for (var key in simple_colors)
    {
      if (color_string == key)
      {
        color_string = simple_colors[key];
      }
    }
    // end of simple type-in colors

    // array of color definition objects
    var color_defs = [
      {
        re: /^rgba\((\d{1,3}),\s*(\d{1,3}),\s*(\d{1,3}),\s*((1(\.0)?)|0?(\.\d*)?)\)$/,
        example: ['rgba(123, 234, 45, 0.5)', 'rgba(255,234,245,1)'],
        process: function (bits){
            return [
                parseInt(bits[1]),
                parseInt(bits[2]),
                parseInt(bits[3]),
                parseFloat(bits[4])
            ];
        }
      },
      {
        re: /^rgb\((\d{1,3}),\s*(\d{1,3}),\s*(\d{1,3})\)$/,
        example: ['rgb(123, 234, 45)', 'rgb(255,234,245)'],
        process: function (bits){
            return [
                parseInt(bits[1]),
                parseInt(bits[2]),
                parseInt(bits[3])
            ];
        }
      },
      {
        re: /^(\w{2})(\w{2})(\w{2})$/,
        example: ['#00ff00', '336699'],
        process: function (bits){
            return [
                parseInt(bits[1], 16),
                parseInt(bits[2], 16),
                parseInt(bits[3], 16)
            ];
        }
      },
      {
        re: /^(\w{1})(\w{1})(\w{1})$/,
        example: ['#fb0', 'f0f'],
        process: function (bits){
            return [
                parseInt(bits[1] + bits[1], 16),
                parseInt(bits[2] + bits[2], 16),
                parseInt(bits[3] + bits[3], 16)
            ];
        }
      }
    ];

    // search through the definitions to find a match
    for (var i = 0; i < color_defs.length; i++)
    {
      var re = color_defs[i].re;
      var processor = color_defs[i].process;
      var bits = re.exec(color_string);
      if (bits)
      {
        var channels = processor(bits);    // bugfix: was global. [ARC 17Jul12]
        this.r = channels[0];
        this.g = channels[1];
        this.b = channels[2];
        if (bits.length>3)
          this.a = channels[3];
        else
          this.a = 1.0;
        this.ok = true;
      }
    }

    // validate/cleanup values
    this.r = (this.r < 0 || isNaN(this.r)) ? 0 : ((this.r > 255) ? 255 : this.r);
    this.g = (this.g < 0 || isNaN(this.g)) ? 0 : ((this.g > 255) ? 255 : this.g);
    this.b = (this.b < 0 || isNaN(this.b)) ? 0 : ((this.b > 255) ? 255 : this.b);
    this.a = (this.a < 0 || isNaN(this.a)) ? 1.0 : ((this.a > 1) ? 1.0 : this.a);

    // some getters
    this.toRGBA = function()
    {
      return 'rgba(' + this.r + ', ' + this.g + ', '  + this.b + ', ' + this.a + ')';
    }
    this.toRGB = function()
    {
      return 'rgb(' + this.r + ', ' + this.g + ', ' + this.b + ')';
    }
    this.toHex = function()
    {
      var r = this.r.toString(16);
      var g = this.g.toString(16);
      var b = this.b.toString(16);
      if (r.length == 1) r = '0' + r;
      if (g.length == 1) g = '0' + g;
      if (b.length == 1) b = '0' + b;
      return '#' + r + g + b;
    }
  }

// ======================================== SHIMS ==========================================
  (function()
  {
    /* ----------------------------------------------------------------------------------------
     * http://paulirish.com/2011/requestanimationframe-for-smart-animating/
     * http://my.opera.com/emoller/blog/2011/12/20/requestanimationframe-for-smart-er-animating
     * requestAnimationFrame polyfill by Erik Möller
     * fixes from Paul Irish and Tino Zijdel
     *-----------------------------------------------------------------------------------------*/
    var lastTime = 0;
    var vendors = ['ms', 'moz', 'webkit', 'o'];
    for(var x = 0; x < vendors.length && !window.requestAnimationFrame; ++x)
    {
      window.requestAnimationFrame = window[vendors[x]+'RequestAnimationFrame'];
      window.cancelAnimationFrame = window[vendors[x]+'CancelAnimationFrame']
                                 || window[vendors[x]+'CancelRequestAnimationFrame'];
    }

    if (!window.requestAnimationFrame)
      window.requestAnimationFrame = function(callback, element)
      {
        var currTime = new Date().getTime();
        var timeToCall = Math.max(0, 16 - (currTime - lastTime));
        var id = window.setTimeout(function() { callback(currTime + timeToCall); },
          timeToCall);
        lastTime = currTime + timeToCall;
        return id;
      };

    if (!window.cancelAnimationFrame)
      window.cancelAnimationFrame = function(id)
      {
        clearTimeout(id);
      };

    if (!Date.now)
      Date.now = function now()
      {
        return new Date().getTime();
      };

    /* create a copy (not just a reference) of an object */
    if (!Object.prototype.clone)
    {
      Object.prototype.clone = function()
      {
        var newObj = (this instanceof Array) ? [] : {};
        for (i in this)
        {
          if (i == 'clone') continue;
          if ((this[i] && typeof this[i] == "object")&&(i != 'cgo'))
          {
            newObj[i] = this[i].clone();
          }
          else
            newObj[i] = this[i]
        }
        return newObj;
      }
    };

    if (typeof(isArray) == 'undefined')
    {
      isArray = function(obj)
      {
        return Object.prototype.toString.call(obj) === '[object Array]';
      }
    };

    if (typeof(isNumber) == 'undefined')
    {
      isNumber = function(o)
      {
        return ! isNaN (o-0) && o !== null && o !== "" && o !== false;
      }
    };

    if (typeof(addLoadEvent) == 'undefined')
    {
      // simple add event handler that has the handlers called in the sequence that they were set
      addLoadEvent = function(obj, func)
      {
      	var oldonload = obj.onload;

      	if (typeof obj.onload != 'function')
          obj.onload = func;
      	else
        	obj.onload = function(){oldonload();	func();}
      }
    };

    if (typeof(addEvent) == 'undefined')
    {
      addEvent = function(element, eventType, handler)
      {
        if (element.attachEvent)
         return element.attachEvent('on'+eventType, handler);
        else
         return element.addEventListener(eventType, handler, false);
      }
    };

    if (typeof(removeEvent) == 'undefined')
    {
      removeEvent = function(element, eventType, handler)
      {
       if (element.removeEventListener)
          element.removeEventListener (eventType, handler, false);
       if (element.detachEvent)
          element.detachEvent ('on'+eventType, handler);
      }
    };

    if (typeof(Array.prototype.map) == 'undefined')
    {
      Array.prototype.map = function(fun)
      {
        var len = this.length;
        if (typeof fun != "function")
          throw new TypeError();
        var res = new Array(len);
        var thisp = arguments[1];
        for (var i = 0; i < len; i++)
        {
          if (i in this)
            res[i] = fun.call(thisp, this[i], i, this);
        }
        return res;
      };
    };

    if (typeof(matrixMultiply4x4) == 'undefined')
    {
      /* Multiply two matricies */
      matrixMultiply4x4 = function(m1, m2)
      {
        var result = [[1, 0, 0, 0],
                      [0, 1, 0, 0],
                      [0, 0, 1, 0],
                      [0, 0, 0, 1]];
        var cols = m1[0].length;
        var rows = m1.length;

        if (cols != m2.length)
          alert("matrix size error");

        for (var x = 0; x < cols; x++)
        {
          for (var y = 0; y < rows; y++)
          {
            var sum = 0;
            for (var z = 0; z < cols; z++)
            {
              sum += m1[y][z] * m2[z][x];
            }
            result[y][x] = sum;
          }
        }
        return result;
      }
    };

    if (typeof(transformPoint) == 'undefined')
    {
      transformPoint = function(point, m)
      {
        var p = [[point.x, point.y, point.z, 1]];
        var pm = matrixMultiply4x4(p, m);

        point.x = pm[0][0];
        point.y = pm[0][1];
        point.z = pm[0][2];

        point.tx = point.x;
        point.ty = point.y;
        point.tz = point.z;
      }
    };

    if (typeof(softTransformPoint) == 'undefined')
    {
      softTransformPoint = function(point, m)
      {
        var p = [[point.x, point.y, point.z, 1]];
        var pm = matrixMultiply4x4(p, m);

        point.tx = pm[0][0];
        point.ty = pm[0][1];
        point.tz = pm[0][2];
      }
    };

  }());
