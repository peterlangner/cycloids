/*=================================================================
  Filename: Cycloids1_4_3.js
  Rev: 1.4.3 from 2018-08-19
  Changes:
   - Correction of Minkowski coordinates Q and R. They were interchanged.
   - Enlargement of the greek letters for better readability. Now controllable via a global variable font_size_geek_letters
   - correction of arrow heads
   - pre-settings of functions changed
  By: Peter Langner, www.adventas.de
  Web App: cycloids.adventas.de
  License: Apache License 2.0
  Github: https://github.com/peterlangner/cycloids
  =================================================================*/
/**
 * This function checks, if the used browser supports MathML
 */
function supports_MathML(){
  var MathML = true;
  if (navigator.appName.slice(0,8)=="Netscape") 
    if (navigator.appVersion.slice(0,1)>="5") MathML = true;
    else supports_MathML = false;
  else if (navigator.appName.slice(0,9)=="Microsoft" && navigator.appVersion.slice(0,1)<"5")
    try {
        var ActiveX = new ActiveXObject("MathPlayer.Factory.1");
        MathML = true;
    } catch (e) {
        MathML = false;
    }
  else if (navigator.appName.slice(0,9)=="Microsoft" && navigator.appVersion.slice(0,1)>="5")
  	MathML = false;
  else if (navigator.appName.slice(0,5)=="Opera") 
    if (navigator.appVersion.slice(0,3)>="9.5") MathML = true;
    else MathML = false;
  else MathML = false;
  return MathML;
}

/**
 * This funktion converts the name of a greek letter into its unicode equivalent.
 * It can than be printed with the funktion drawVectorText( ).
 *
 * @param {letter} Name of the greek letter.
 */
function greek_char(letter){
	switch(letter) {
	case 'alpha': return '\u03B1';
	case 'beta':  return '\u03B2';
	case 'gamma': return '\u03B3';
	case 'delta': return '\u03B4';
	case 'xi':    return '\u03BE';
	case 'eta':   return '\u03B7';
	default: return letter;
	}
	
}

/**
 * This global variable controls the font size of the greek letters.
 */
var font_size_greek_letter = 15;

/**
 * This funktion returns the SVG-data of a circle.
 *
 * @param {diameter} Diameter of the circle in terms of world coordinate.
 */
function circle(diameter){
   var d = diameter || 1;
   return ["m", -0.5*d,0,
   "c", 0,-0.27614*d, 0.22386*d,-0.5*d, 0.5*d,-0.5*d,
   "c", 0.27614*d,0, 0.5*d,0.22386*d, 0.5*d,0.5*d,
   "c", 0,0.27614*d, -0.22386*d,0.5*d, -0.5*d,0.5*d,
   "c", -0.27614*d,0, -0.5*d,-0.22386*d, -0.5*d,-0.5*d, "z"];
   }

/**
 * This funktion returns the SVG-data of a square.
 *
 * @param {width} Width of the square in terms of world coordinate.
 */
function square(width){
    var w = width || 1;
    return ["m", 0.5*w, -0.5*w, "l", 0, w, -w, 0, 0, -w, "z"];
   }

/**
 * Find the maximum value in an array A.
 * @param A
 * @retuns Maximal number
 */
function getMax(A) 
{
  var max = A[0];

  for (var i=1; i<A.length; i++)
  {
    if (A[i]>max)
      max = A[i];
  }
  return max;
}

/**
 * Find the minimal value in an array A.
 * @param A
 * @retuns mininmal number
 */
function getMin(A)
{
  var min = A[0];

  for (var i=1; i<A.length; i++)
  {
    if (A[i]<min)
      min = A[i];
  }
  return min;
}

/**
 * This function calculates the velocity of a system based on delta and gamma parameters of the cycloid.
 * @param delta
 * @param gamma
 * @returns velocity
 */
function get_velocity(delta,gamma){ return (gamma - delta) / (gamma + delta); }


/**
 * Draws an arrow from one position to another and 
 * adds a colored text label at the head of the arrow. 
 *
 * @param {g} The object, in which the arrow is to be drawn.
 * @param {from_x} Starting from x.
 * @param {from_y} Starting from y.
 * @param {to_x} Drawn to x.
 * @param {to_y} Drawn to y.
 * @param {from_x} Color of the text label.
 * @param {label}  The text label attached to the arrow head.
 * @param {fontSize} Font size of the lable.
 */
function drawArrow(g, from_x, from_y, to_x, to_y, color, label, fontSize){
	var data = [];
	data.push(from_x, from_y);
	data.push(to_x,to_y); 
	g.drawPath(data, {strokeColor : color} );
	
	// From left to right
	if (from_y == to_y && from_x < to_x ){
	   var data = [];
	   data.push(to_x-0.3, to_y+0.1);
	   data.push(to_x,to_y); 
	   data.push(to_x-0.3, to_y-0.1);
	   g.drawPath(data, {strokeColor : color}  );
	   if (label != null){
		   if (to_y > 10){
		     g.drawVectorText(label, {strokeColor : color , x : to_x , y : to_y-0.6, fontSize : fontSize, lorg:5}); 
		   } else {
			 g.drawVectorText(label, {strokeColor : color , x : to_x , y : to_y-0.3, fontSize : fontSize, lorg:5});
		   } 
	   }
	}
	
	//From top to bottom 
	if (from_x == to_x && to_y < from_y ){
	   var data = [];
	   data.push(to_x-0.1, to_y+0.3);
	   data.push(to_x,to_y); 
	   data.push(to_x+0.1, to_y+0.3);
	   g.drawPath(data, {strokeColor : color} );
	   if (label != null){
	   if (to_y > 10){
		   g.drawVectorText(label, {strokeColor:color, x:to_x, y:to_y-0.6, fontSize:fontSize, lorg:5});  
	   } else {
		   g.drawVectorText(label, {strokeColor:color, x:to_x, y:to_y-0.3, fontSize:fontSize, lorg:5}); 
	   }
	   }
	}
     // alpha, gamma direction	
	if (from_x < to_x && from_y > to_y){
	   var data = [];
	   data.push(to_x-0.3, to_y+0.1);
	   data.push(to_x,to_y); 
	   data.push(to_x-0.1, to_y+0.3);
	   g.drawPath( data, {strokeColor : color} );
	   if (label != null){
	     var text_x =  from_x + (to_x - from_x)/2+0.3;
	     var text_y =  from_y + (to_y - from_y)/2+0.3;
	     g.drawVectorText(label, {strokeColor:color , x:text_x , y:text_y, fontSize:fontSize, lorg:5});
	   }
	}
        // beta and delta direction	
	if (from_x > to_x  && from_y > to_y){
	   var data = [];
	   data.push(to_x+0.3, to_y+0.1);
	   data.push(to_x,to_y); 
	   data.push(to_x+0.1, to_y+0.3);
	   g.drawPath(data, {strokeColor : color} );
	   if (label != null){
	     var text_x =  from_x + (to_x - from_x)/2+0.3;
	     var text_y =  from_y + (to_y - from_y)/2-0.3;
	     g.drawVectorText(label, {strokeColor:color , x:text_x , y:text_y, fontSize:fontSize, lorg:5});
	   }
	}
}
function drawLine(g, from_x, from_y, to_x, to_y, color){	
	 var data = [];
	 data.push(from_x, from_y);
	 data.push(to_x, to_y);
	 g.drawPath(data, {strokeColor : color} );
}
function is_even(n){
   return ((n % 2) == 0);	
}
function make_even(n){
	if (is_even(n))	{
	   return n;
	} else {
	  if (n < 0) {return n-1;} else {return n+1;}
	}
}
function drawStandardGrid(g, xmin, xmax, ymin, ymax, color){

	//2nd quadrant
	var x = xmin; var y = ymin;
	var xm = xmin; var ym = ymin;
	while (x < xmax || y < ymax){	
	   if (x < xmax) {x=x+2;} else {ym=ym+2;}
	   if (y < ymax) {y=y+2;} else {xm=xm+2;}
	   drawLine(g, xm, y, x, ym, color);
	}
	
	//4th quadrant
	var x = xmax; var y = ymax;
	var xm = xmax; var ym = ymax;
	while (x > xmin || y > ymin){
	   if (x > xmin) {x=x-2;} else {ym=ym-2;}
	   if (y > ymin) {y=y-2;} else {xm=xm-2;}
	   drawLine(g, xm, y, x, ym, color);
	}
	
	//3rd quadrant
	var x = xmax;var y = ymin;
	var xm = xmax; var ym = ymin;
	while ((x > xmin || y < ymax)){
	   if (x > xmin) {x=x-2;} else {ym=ym+2;}
	   if (y < ymax) {y=y+2;} else {xm=xm-2;}
	   drawLine(g, xm, y, x, ym, color);
	}
	
	//4th quadrant
	var x = xmin;var y = ymax;
	var xm = xmin; var ym = ymax;
	while (x < xmax || y > ymin){
		if(x < xmax){x=x+2;} else {ym=ym-2;}
		if(y > ymin){y=y-2;} else {xm=xm+2;}
	  drawLine(g,x, ym, xm, y, color);
	}
}

function drawCycloid(g, x1, t1, x2, t2, colorXT, showXT, alpha, beta, gamma, delta, colorXE, showXE)
{
	var fontSize = 10;
	var x0 = 0;
	var t0 = 0;
	var x3 = x1 + x2;
	var t3 = t1 + t2;
/// ToDo: calculate O,P,R and Q from alpha, beta, gamma, delta and the display them	
	var xi0 = 0;
	var eta0 = 0;
	var xi1 = alpha;
	var eta1 = -beta;
	var xi2 = gamma;
	var eta2 = delta;
	var xi3 = xi1 + xi2;
	var eta3 = eta1 + eta2;
	
    var data = [];
	data.push(x0, t0);
	data.push(x1, -t1); 
	data.push(x3, -t3); 
	data.push(x2, -t2);
	data.push(x0, t0);
	g.drawPath(data, null, null, colorXT );
	
	if (showXT) {
	  var x = x0;
	  var t = t0;
	  g.drawText("("+x+","+t+")", {fillColor : colorXT , x : x0, y : -t0+0.2, fontSize : fontSize, lorg : 5} );
	  
	  var x = x1;
	  var t = t1;
	  g.drawText("("+x+","+t+")", {fillColor : colorXT , x : x1, y : -t1+0.2, fontSize : fontSize, lorg : 5} );
	  
	  var x = x2;
	  var t = t2;
	  g.drawText("("+x+","+t+")", {fillColor : colorXT , x : x2, y : -t2-0.2, fontSize : fontSize, lorg : 5} );
	  
	  var x = x3;
	  var t = t3;
	  g.drawText("("+x+","+t+")", {fillColor : colorXT , x : x3 , y : -t3-0.2, fontSize : fontSize, lorg : 5} );
	};
	
	if (showXE) {
	  if (xi3 > 10) {offset=0.8;} else {offset=0.4;};
	  g.drawText("O = ("+xi0+","+eta0+")", {fillColor : colorXE, x:x0, y : -t0+offset, fontSize : fontSize, lorg : 5} );
	  g.drawText("P = ("+xi1+","+eta1+")", {fillColor : colorXE, x:x1, y : -t1+offset, fontSize : fontSize, lorg : 5} );
	  g.drawText("Q = ("+xi2+","+eta2+")", {fillColor : colorXE, x:x2, y : -t2-offset, fontSize : fontSize, lorg : 5} );
	  g.drawText("R = ("+xi3+","+eta3+")", {fillColor : colorXE, x:x3, y : -t3-offset, fontSize : fontSize, lorg : 5} );
	};
}
function drawTransition(g, transition, label, color){
	var distance = 0.1;
	var x = transition[0];
	var t = transition[1];
	var y = -t;
	
	g.drawShape(square(distance*2),{x:x,y:y,fillColor:color, iso:true});
	g.drawShape(square(distance*2-0.05),{x:x,y:y,fillColor:'white',iso:true});
	g.drawHTMLText(label, {x:x, y:y-4*distance, fillColor:color, fontSize:8, lorg:5});
}
function drawState(g, state, label, marked, color){
	var distance = 0.1;
	var x = state[0];
	var t = state[1];
	var y = -t;
	g.drawShape(circle(0.2),{x:x,y:y,fillColor:color,iso:true});
	g.drawShape(circle(0.15),{x:x,y:y,fillColor:'white',iso:true});	
 	g.drawHTMLText(label, {x:x, y:y-4*distance, fillColor:color, fontSize:8, lorg:5});
	if (marked){
	   g.drawShape(circle(0.05),{x:x,y:y,fillColor:color,iso:true});
	}
}
function drawFlow(g, flow, color){
	g.drawArrow(flow[1][0],-flow[1][1],{x:flow[0][0],y:-flow[0][1],fillColor:color});
}

function x(xi,eta){return xi - eta;}

function t(xi,eta){return xi + eta;}

function p(xi, eta, gamma, delta, A){return (delta * xi - gamma * eta)/A;}

function q(xi, eta, alpha, beta, A){return (beta * xi + alpha * eta)/A;}

function A(alpha, beta, gamma, delta){return alpha * delta + beta * gamma;}

function xi(x, t){return x-t;}

function eta(x, t){return -x-t;}

function drawNet(g, net, color){

	for(var i=0;i<net[0].length;i++){
		drawState(g, net[0][i], net[0][i][2], false, color);
	};
	for(var i=0;i<net[1].length;i++){
		drawTransition(g, net[1][i], net[1][i][2], color); 
	};
	for(var i=0;i<net[2].length;i++){
		drawFlow(g, net[2][i], color); 
	};
}
/**
 * Returns the area type of a transition according to [Valk 2018].
 *
 * @param {alpha} alpha.
 * @return {AreaType} AreaType as the result.
 */
function getAreaType(alpha, beta, gamma, delta, xi, eta){
	if ( ( 0 <= eta && eta <= Math.min(alpha, gamma) ) &&
	     ( -1 * beta / alpha * eta <= xi && xi <= delta / gamma * eta ) ){
		return 'UA';
	} else if ( ( gamma <= alpha && gamma <= eta <= alpha ) &&
		   ( -1 * beta / alpha * eta <= xi && xi <= beta / alpha * ( gamma - eta ) + delta ) ){
	    return 'MA1';
	} else if ( ( alpha <= gamma && alpha <= eta && eta <= gamma ) &&
		    ( delta / gamma * (eta - alpha ) - beta <= xi && xi <= delta / gamma * eta ) ) {
		return 'MA2';
	} else if ( ( Math.max(alpha, gamma) <= eta ) && ( eta <= alpha + gamma ) &&
			( delta / gamma * ( eta - alpha ) - beta <= xi && xi <= beta / alpha * ( gamma - eta ) - delta ) ){
		return 'LA';
	}
	else {
		return '';
	};
}

/**
 * Returns the net of a cycloid. Right now only the transitions are returned.
 * THIS DEFENITLY HAST TO BE REFACORED.
 *
 * @param {alpha} alpha parameter of cycloid.
 * @param {beta}  beta parameter of cycloid.
 * @param {gamma} gamma parameter of cycloid.
 * @param {delta} delta parameter of cycloid.
 * @param {area} Number of transitions.
 * @return {states,transitions,flow} states,transitions,flow of the net as the result.
 */
function getNet(alpha, beta, gamma, delta, A)
{
	var transitions = [];
	var states = [];
	var flow = [];	
	
	function getState(x, y) {
		if ( states.length > 0 ) {
			for(var i = 0; i < states.length; i++){
				if ( states[i][0] == x && states[i][1] == y ) {
					return states[i]
				}
			}
		} 
		// if no state exists yet or no state was found at the given position,
		// we return the empty state.
		return [] 
	}
	
	function getTransition(x, y) {
		if ( transitions.length > 0 ) {
			for(var i = 0; i < transitions.length; i++){
				if ( transitions[i][0] == x && transitions[i][1] == y ) {
					return transitions[i]
				}
			}
		} 
		// if no transition exists yet or no transition was found at the given position,
		// we return the empty transition.
		return [] 
	}
	
	for (var eta = -beta; eta <= delta; eta = eta+1){
		for (var xi=0; xi <= alpha+gamma; xi=xi+1){
			var tp = p(xi, eta, gamma, delta, A);
			var tq = q(xi, eta, alpha, beta, A);
			var sq = tq - 0.5;
			var sp = tp - 0.5;
			
// Is the transition t within the fundamental parallelogram?
			if ( eta%1 == 0 && xi%1 == 0 ) {
//			if ( (-eta <= xi ) && ( xi < ( alpha + gamma ) ) && ( delta > eta ) && ( eta > -beta ) ){
				if ( ( (0 <= tp ) && ( tp <  1) ) && ( (0 <= tq )  && ( tq < 1) ) ){
	//			   var t1 = [x(xi,eta),t(xi,eta),getAreaType(alpha, beta, gamma, delta, xi, eta)];
				   var t1 = [x(xi,eta),t(xi,eta), xi.toString( ) + ',' + eta.toString( )];
			//		var t1 = [x(xi,eta),t(xi,eta), null];
				   transitions.push(t1);
				   
/*				   var s1 = [x(xi,eta)+0.5,t(xi,eta)-0.5,xi.toString( ) + ',' + eta.toString( )];
				   states.push(s1);
//				   flow.push([[s1[0]+0.05,s1[1]-0.05]],[t1[0]-0.06,t1[1]+0.06]);
				   flow.push([[s1[0]-0.05,s1[1]+0.05],[t1[0]+0.06,t1[1]-0.06]]);
				   
				   var s2 = [x(xi,eta)-0.5,t(xi,eta)-0.5, sp + ',' + sq ];
				   states.push(s2);
//				   flow.push([[s2[0]-0.05,s2[1]-0.05],[t1[0]-0.06,t1[1]+0.06]]);
				   flow.push([[s2[0]+0.05,s2[1]+0.05],[t1[0]-0.06,t1[1]-0.06]]);
				   
//				   if a previous transition exists, add flow relation
				   var preT1 = getTransition( s1[1],s1[2] )
				   if ( preT1.length > 0 ){
					   flow.push([[preT1[0]+0.05,preT1[1]+0.05],[s1[0]-0.06,s1[1]-0.06]]);
				   }
				   var preT2 = getTransition( x(xi,eta)+0.5,t(xi,eta)-0.5 )
				   if ( preT2.length > 0 ){
					   flow.push([[preT2[0]-0.05,preT2[1]+0.05],[s1[0]+0.06,s1[1]-0.06]]);
				   }	*/			   
				   
				   // if a previous state exists, add flow relation
//				   var preS1 = getState( x(xi,eta)-0.5,t(xi,eta)-0.5 )
//				   if ( preS1.length > 0 ){
//					   flow.push([[preS1[0]+0.05,preS1[1]+0.05],[t1[0]-0.06,t1[1]-0.06]]);
//				   }
//				   var preS2 = getState( x(xi,eta)+0.5,t(xi,eta)-0.5 )
//				   if ( preS2.length > 0 ){
//					   flow.push([[preS2[0]-0.05,preS2[1]+0.05],[t1[0]+0.06,t1[1]-0.06]]);
//				   }
				}
			}
		   // Is the state s within the fundamental parallelogram?	
/*			if ( ( eta%1 == 0 ) || ( xi%1 == 0 ) ) {
				if ( ( ( -0.5 <= sp ) && ( sp <= 0 ) ) && ( (-0.5 <= sq ) && ( sq <= 0 ) ) )
				{
				   var s1 = [x(xi,eta)+0.5,t(xi,eta)+0.5,xi.toString( ) + ',' + eta.toString( )];
				   states.push(s1);	*/			  					
				   // Add the flow relation of the net and adapt the start and end point of the arrow according to the 
				   // diameter of the circle representing the state resp. to the edge length of the box representing 
				   // the transition.			   
				 //  flow.push([[t1[0]+0.06,t1[1]+0.06],[s1[0]-0.05,s1[1]-0.05]]);
				   
//				   if ( t(xi,eta) != 0 ) { 
//					   var s2 = [x(xi,eta)-0.5,t(xi,eta)+0.5, sp + ',' + sq ];
//					   states.push(s2);
				//	   flow.push([[t1[0]-0.06,t1[1]+0.06],[s2[0]+0.05,s2[1]-0.05]]);
//				   }				
//				}	
//			}
		}
			
	}
	return [states,transitions,flow];
}
function drawXEAxis(g, xmin, xmax, ymin, ymax, color){	
	//4th quadrant
	if (xmax == ymax){
	   drawLine(g,xmax,ymax,0,0,color);
	} else if (ymax < xmax){
	   drawLine(g,ymax,ymax,0,0,color);
	} else if (xmax < ymax){
	   drawLine(g,xmax,xmax,0,0,color);
	};
	
	//1st quadrant
	if (xmax == -ymin){
	   drawArrow(g,0,0,xmax,ymin,color, null, null);
	   g.drawText(greek_char('xi'), {fillColor : color , x : xmax , y : ymin-0.3, fontSize : font_size_greek_letter, lorg : 5} ); 
	   
	} else if (ymin < -xmax){
	   drawArrow(g,0,0,xmax,-xmax,color, null, null);
	   g.drawText(greek_char('xi'), {fillColor : color , x : xmax , y : -xmax, fontSize : font_size_greek_letter, lorg : 5} );
	} else if(-xmax < ymin){
	   drawArrow(g,0,0,-ymin,ymin,color, null, null);
	   g.drawText(greek_char('xi'), {fillColor : color , x : -ymin , y : ymin, fontSize : font_size_greek_letter, lorg : 5} );
	};
	
	//3rd quadrant
	if (-xmin == ymax){
	   drawLine(g,xmin,ymax,0,0,color);
	} else if (-xmin < ymax){
	   drawLine(g, xmin, -xmin,0,0,color);
	} else if (-xmin > ymax){
	   drawLine(g,-ymax,ymax,0,0,color);
	};
	
	//2nd quadrant
	if (xmin == ymin){
	   drawArrow(g, 0, 0, xmin, ymin, color, null, null);
	   g.drawText(greek_char('eta'), {fillColor : color , x : xmin , y : ymin-0.3, fontSize : font_size_greek_letter, lorg : 5} );
	} else if (xmin > ymin){
	   drawArrow(g, 0, 0, xmin, xmin, color, null, null);
	   g.drawText(greek_char('eta'), {fillColor : color , x : xmin , y : xmin-0.3, fontSize : font_size_greek_letter, lorg : 5} );
	} else if (ymin > xmin){
	   drawArrow(g, 0, 0, ymin, ymin, color, null, null);
	   g.drawText(greek_char('eta'), {fillColor : color , x : ymin , y : ymin-0.3, fontSize : font_size_greek_letter, lorg : 5} );
	};
	
	//observer
	g.drawShape(circle(0.1), {FillColor : color, x : 0, y: 0, iso : true } );
	g.drawText("Observer", {fillColor : color , x : 0.25*xmax/2 , y : 0.1*xmax/2, fontSize : 8, lorg : 4} );
	
	if (xmax > 6){y1=-1;y2=0.2;y3=1;} else {y1=-0.5;y2=0.1;y3=0.5;};
	
	g.drawText("Present", {fillColor : color , x : xmin , y : y1, fontSize : 8, lorg : 5} );
	g.drawText("Present", {fillColor : color , x : xmax , y : y1, fontSize : 8, lorg : 5} );
	g.drawText("Past", {fillColor : color , x : 0 , y : ymax+y2, fontSize : 8, lorg : 5} );
	g.drawText("Future", {fillColor : color , x : 0 , y : ymin-y3, fontSize : 8, lorg : 5} );
}
function is_balanced(alpha, beta, gamma, delta){
	return (alpha == gamma && beta == delta);
}
function set_parameter(n){
 if (is_number(n)){ return 1 * n; } else { throw 'Please enter a number.';}
}
function Cycloid(cvsID)    
{
	try {
		var g = new Cango(cvsID);  // create a graphics context
		
		   var alpha = set_parameter(document.Formular.alpha.value);
		   var beta = set_parameter(document.Formular.beta.value);
		   var gamma = set_parameter(document.Formular.gamma.value);
		   var delta = set_parameter(document.Formular.delta.value);
			   
		   if ( A(alpha, beta, gamma, delta) <= 0 ){
		      throw '<p style="color:red">Please enter &alpha;, &beta;, &gamma;, &delta; &ge; 0 and A > 0.</p>';
		   } 
		   document.getElementById('result').innerHTML='<p> </p>';
		   var result = "";
		
		   var showXY = document.Formular.showXY.checked;
		   var showXE = document.Formular.showXE.checked;
		   var showGrid = document.Formular.showGrid.checked;
		   var showXEAxis = document.Formular.showXEAxis.checked;
		   var showXTAxis = document.Formular.showXTAxis.checked;
		   var showABGD = document.Formular.abgd.checked;
		   var useMathML = document.Formular.useMathML.checked;
		   
		   var showTransitions = document.Formular.showTransitions.checked;
		
		   // Eight coordinates, from which the standard tile is drawn
		   var x_coor = [];
		   var t_coor = [];
		   
		   var x0 = 0; x_coor.push(0);
		   var t0 = 0; t_coor.push(0);
		   
		   var x1 = alpha + beta; x_coor.push(x1);
		   var t1 = alpha - beta; t_coor.push(t1);
		
		   var x2 = gamma - delta; x_coor.push(x2);
		   var t2 = gamma + delta; t_coor.push(t2);
		   
		   var x3 = x1 + x2; x_coor.push(x3);
		   var t3 = t1 + t2; t_coor.push(t3);
		   
		   var x4 = x3 - beta; x_coor.push(x4);
		   var t4 = t3 + beta; t_coor.push(t4);
		   
		   var x5 = x3 + delta; x_coor.push(x5);
		   var t5 = t3 - delta; t_coor.push(t5);
		   
		   x_coor.push(-beta);
		   t_coor.push(-beta);
		   
		   x_coor.push(-delta);
		   t_coor.push(-delta);
		
		   var xmax = make_even(Math.ceil(getMax(x_coor)));
	       var xmin = make_even(Math.floor(getMin(x_coor)));
           var tmin = make_even(-1 * Math.ceil(getMin(t_coor))); 
		   var tmax = make_even(-1 * Math.floor(getMax(t_coor)));
		   
		   if (Math.abs(tmin) > Math.abs(xmin)){xmin = -tmin;}
		   if (Math.abs(tmin) < Math.abs(xmin)){tmin = -xmin;}
		   
		   if (Math.abs(tmax) > Math.abs(xmax)){xmax = -tmax;}
		   if (Math.abs(tmax) < Math.abs(xmax)){tmax = -xmax;}
		   
           var ymin = tmax;
           var ymax = tmin;
           
           var area = A(alpha, beta, gamma, delta);
			
		   g.clearCanvas();
		   g.gridboxPadding(10, 10, 10, 10);
		   g.setWorldCoordsRHC(xmin, ymin, xmax-xmin, ymax-ymin);
		   
		   if (showGrid){
			drawStandardGrid(g,xmin,xmax,ymin,ymax,'grey');
		   }
		 
		   if (showXTAxis) {
			drawArrow(g,0,ymax,0,ymin,'black', "t (time)", 10);
			drawArrow(g,xmin,0,xmax,0,'black', "x (space)", 10);
		   }
		
		   if (showXEAxis){
			drawXEAxis(g, xmin, xmax, ymin, ymax, 'purple');	
		   }
		
		   if (showABGD){
			drawArrow(g,beta,beta,0,0,'green', greek_char('beta'), font_size_greek_letter );
			drawArrow(g,beta,beta,x1,-t1,'red', greek_char('alpha'), font_size_greek_letter);
			
			drawArrow(g,0,0,-delta,-delta,'red', greek_char('delta'), font_size_greek_letter);
			drawArrow(g,-delta,-delta,x2,-t2,'green', greek_char('gamma'), font_size_greek_letter);
			
			drawArrow(g,x3,-t3,x4,-t4,'green', greek_char('beta'), font_size_greek_letter);
			drawArrow(g,x2,-t2,x4,-t4,'red', greek_char('alpha'), font_size_greek_letter);
			
			drawArrow(g,x5,-t5,x3,-t3,'red', greek_char('delta'), font_size_greek_letter);
			drawArrow(g,x1,-t1,x5,-t5,'green', greek_char('gamma'), font_size_greek_letter);
		   }
		   
			function drawSpaceOrthoid(g, gamma, delta, color) {
				for(x = xmin; x <= xmax; x++){
					for(y = ymax; y > ymin; y--){
						var i = x+gamma;
						var k = y+delta;
						g.drawHTMLText('('+i+','+k+')', {x:x, y:y-0.4, fillColor:color, fontSize:8, lorg:5});
					}
				}
			}
		
		   drawCycloid(g, x1, t1, x2, t2, 'blue', showXY, alpha, beta, gamma, delta, 'purple', showXE);
		   
		   var Net = getNet(alpha, beta, gamma, delta, area);
		   
		   if (showTransitions) { drawNet(g, Net, 'brown'); }		   
		   
		   if (alpha == 0 || beta == 0 || delta == 0 || gamma == 0){
			   result = result + "<p>It's a degenerate cycloid (&alpha; = 0 &or; &beta; = 0 &or; &gamma; = 0 &or; &delta; = 0) and A > 0.</p>";
		   } 
		   
		   if( (alpha == 1 || beta == 1 || delta == 1 || gamma == 1 ) && !( alpha == 0 || beta == 0 || delta == 0 || gamma == 0 ) ){
		      if(alpha == gamma && beta == delta){
			result = result + "<p>It's a pre-cycloid (&alpha; = 1 &or; &beta; = 1 &or; &gamma; = 1 &or; &delta; = 1), which is balanced (&alpha; = &gamma; &and; &beta; = &delta;). They are live, safe and pure nets.</p>";
		      } else {
			result = result + "<p>It's a pre-cycloid (&alpha; = 1 &or; &beta; = 1 &or; &gamma; = 1 &or; &delta; = 1). They are live, safe and pure nets.</p>";
		      }
		   }
		   
		   if(alpha >= 2 && beta >= 2 && delta >= 2 && gamma >= 2 ){
		      if(is_balanced(alpha, beta, gamma, delta)){
			result = result + "<p>It's a cycloid (&alpha; &ge; 2 &and; &beta;  &ge; 2 &and; &gamma;  &ge; 2 &and; &delta;  &ge; 2), which is balanced (&alpha; = &gamma; &and; &beta; = &delta;).<br> They are live and secure nets, which are made from 4-meshes.</p>";
		      } else {
			result = result + "<p>It's a cycloid (&alpha; &ge; 2 &and; &beta;  &ge; 2 &and; &gamma;  &ge; 2 &and; &delta;  &ge; 2). They are live and secure nets, which are made from 4-meshes.</p>";
		      }
		      
		      var L = ((gamma + delta) / 2 ) / Math.sqrt(gamma * delta);
		      if (useMathML){
		         result = result + "<p>Lorenz Factor <math xmlns='http://www.w3.org/1998/Math/MathML'><mi>L</mi><mo>=</mo><mfrac><mrow><mi>(</mi><mi>&gamma;</mi><mo>+</mo><mi>&delta;</mi><mi>)</mi><mo>/</mo><mi>2</mi></mrow><mrow><msqrt><mi>&gamma;</mi><mo>&middot;</mo><mi>&delta;</mi></msqrt></mrow></mfrac><mo>=</mo><mfrac><mrow><mi>(</mi><mi>"+gamma+"</mi><mo>+</mo><mi>"+delta+"</mi><mi>)</mi><mo>/</mo><mi>2</mi></mrow><mrow><msqrt><mi>"+gamma+"</mi><mo>&middot;</mo><mi>"+delta+"</mi></msqrt></mrow></mfrac><mo>=</mo><mi>"+L+"</mi></math>";
		       } else {
		   	 result = result + "<p>Lorenz Factor L = ((&gamma; + &delta;) / 2 ) / sqrt(&gamma; &middot; &delta;) = (("+gamma+" + "+delta+") / 2) / sqrt("+gamma+" &middot; "+delta+") = "+L+"</p>";
		       }
		    }
		   
		   var v = get_velocity(delta,gamma);
		   var v1 = gamma - delta;
		   var v2 = gamma + delta;
		   if (useMathML){
		      result = result + "<p>Velocity <math xmlns='http://www.w3.org/1998/Math/MathML'><mi>v</mi><mo>=</mo><mfrac><mi>(&gamma; - &delta;)</mi><mi>(&gamma; + &delta;)</mi></mfrac><mo>=</mo><mfrac><mi>("+gamma+" - "+delta+")</mi><mi>("+gamma+" + "+delta+")</mi></mfrac><mo>=</mo><mfrac><mi>"+v1+"</mi><mi>"+v2+"</mi></mfrac><mo>=</mo><mi>"+v+"</mi><mi>c</mi></math>, and</p>";
		   } else {
		      result = result + "<p>Velocity v = (&gamma; - &delta;) / (&gamma; + &delta;) = ("+gamma+" - "+delta+") / ("+gamma+" + "+delta+") = "+v1+" / "+v2+" = "+v+" c, </p>";
		   }
//		   result = result + "<p>The <i>Velocity</i> v is the speed of the moving system.</p>";
		   
		   var w1 = alpha - beta;
		   var w2 = alpha + beta;
		   var w = w1 / w2;
		   if (useMathML){
		     result = result + "<p>Slowness <math xmlns='http://www.w3.org/1998/Math/MathML'><mi>w</mi><mo>=</mo><mfrac><mi>(&alpha; - &beta;)</mi><mi>(&alpha; + &beta;)</mi></mfrac><mo>=</mo><mfrac><mi>("+alpha+" - "+beta+")</mi><mi>("+alpha+" + "+beta+")</mi></mfrac><mo>=</mo><mfrac><mi>"+w1+"</mi><mi>"+w2+"</mi></mfrac><mo>=</mo><mi>"+w+"</mi><mfrac><mi>1</mi><mi>c</mi></mfrac></math></p>";
		   } else {
		     result = result + "<p>Slowness w = (&alpha; - &beta;) / (&alpha; + &beta;) = ("+alpha+" - "+beta+") / ("+alpha+" + "+beta+") = "+w1+" / "+w2+" = "+w+" /c</p>";
		   }
//		    result = result + "<p>The <i>Slowness</i> w tells us, how far the structure of the Cycloid slows down it's movement.</p>";
		    
		   if (useMathML){
		      result = result + "<p>Area <math xmlns='http://www.w3.org/1998/Math/MathML'><mi>A</mi><mo>=</mo><mi>&alpha;</mi><mi>&delta;</mi><mo>+</mo><mi>&beta;</mi><mi>&gamma;</mi><mo>=</mo><mi>"+alpha+"</mi><mo>&middot;</mo><mi>"+delta+"</mi><mo>+</mo><mi>"+beta+"</mi><mo>&middot;</mo><mi>"+gamma+"</mi><mo>=</mo><mi>"+area+"</mi><math>"+"&nbsp;Transitions.</p>";
		   } else {
		      result = result + "<p> Area A = &alpha; &middot; &delta; + &beta; &middot; &gamma; = "+alpha+" &middot; "+delta+" + "+beta+" &middot; "+gamma+" = "+area+" &nbsp; Transitions.</p>";
	   }
//		   result = result + "<p>The <i>area</i> A of each fundamental parallelogram, i.e. the numer of transitions in the Cycloid, is the combinatorical cost of each solution.</p>";
		   document.getElementById('result').innerHTML=result;
		   
//		   drawSVL('Analysis');
	}
	catch (e) {
	   error = '<p style="color:red">'+e+'</p>';
	   document.getElementById('result').innerHTML=error;
	}
	
}
function setValues(canvasID, cycloid){
	switch (cycloid){
		case '1': {alpha=1;beta=1;gamma=1;delta=1;break;}  // Bit-pair-Equality
		case '2': {alpha=1;beta=0;gamma=0;delta=2;break;}  // Dual of the two state automation - not a net!
		case '3': {alpha=2;beta=2;gamma=1;delta=1;break;}  // Synchronizer, Bit Exchange
		case '4': {alpha=2;beta=0;gamma=0;delta=2;break;}  // Synchronizer, Bit Exchange (deg.)
		case '5': {alpha=2;beta=1;gamma=2;delta=1;break;}  // XOR-Transfer 
		case '6': {alpha=2;beta=0;gamma=1;delta=2;break;}  // XOR-Transfer (deg.)
		case '7': {alpha=2;beta=2;gamma=2;delta=2;break;}  // Majority Transfer
		case '8': {alpha=4;beta=0;gamma=0;delta=2;break;}  // Quine-Transfer (deg.)
		case '9': {alpha=4;beta=4;gamma=4;delta=4;break;}  // System at rest
		case '10': {alpha=6;beta=2;gamma=6;delta=2;break;} // System in Motion
	}
	document.Formular.alpha.value = alpha;
	document.Formular.beta.value = beta;
	document.Formular.gamma.value = gamma;
	document.Formular.delta.value = delta;
	Cycloid(canvasID);
}
function is_number(n){var regex = /[0-9]/;return regex.test(n);}

function onLoad(){
	if (supports_MathML()){document.Formular.useMathML.checked = "checked";} else {document.Formular.useMathML.checked = "";};
	document.getElementById("ShowCycloid").click();
}
