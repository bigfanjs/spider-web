window.requestAnimFrame =
  window.requestAnimationFrame ||
  window.webkitRequestAnimationFrame ||
  window.mozRequestAnimationFrame ||
  window.oRequestAnimationFrame ||
  window.msRequestAnimationFrame ||
  function(callback) {
    window.setTimeout(callback, 1000 / 60);
  };

let ctx, canvas, web;

const Mouse = {
  down: false,
  button: 1,
  x: 0,
  y: 0,
  px: 0,
  py: 0
};

const Settings = {
  physics_accuracy: 3,
  mouse_influence: 120,
  mouse_cut: 5,
  gravity: 1200,
  start_y: 20,
  spacing: 25,
  tear_distance: 60,
  W: 7,
  Y: 6,
  offset: 20
};

const Point = {
  x: 0,
  y: 0,
  px: 0,
  py: 0,
  vx: 0,
  vy: 0,
  pin_x: 0,
  pin_y: 0,
  constraints: [],
  init(x, y) {
    this.x = x;
    this.y = y;
    this.px = x;
    this.py = y;
    this.vx = 0;
    this.vy = 0;
    this.pin_x = null;
    this.pin_y = null;

    this.constraints = [];
  },
  drawPoint() {
    ctx.beginPath();
    ctx.arc(this.x, this.y, 2, 0, 2 * Math.PI, true);
    ctx.closePath();
    ctx.fill();
  },
  draw() {
    if (!this.constraints.length) return;
    var i = this.constraints.length;
    while (i--) this.constraints[i].draw();
  },
  resolve_constraints() {
    if (this.pin_x != null && this.pin_y != null) {
      this.x = this.pin_x;
      this.y = this.pin_y;
    }

    var i = this.constraints.length;
    while (i--) {
      this.constraints[i].resolve();
    }
  },
  update(delta) {
    const diff_x = this.x - Mouse.x;
    const diff_y = this.y - Mouse.y;
    const dist = Math.sqrt(diff_x * diff_x + diff_y * diff_y);

    if (Mouse.button == 1 && dist < 20) {
      this.x = Mouse.x;
      this.y = Mouse.y;
    }

    this.addForce(0, Settings.gravity);

    delta *= delta;

    nx = this.x + (this.x - this.px) * 0.99 + (this.vx / 2) * delta;
    ny = this.y + (this.y - this.py) * 0.99 + (this.vy / 2) * delta;

    this.px = this.x;
    this.py = this.y;

    this.x = nx;
    this.y = ny;

    this.vy = this.vx = 0;
  },
  attach(point, cp) {
    const constraint = Object.create(Constraint);
    const diff_x = point.x - this.x;
    const diff_y = point.y - this.y;

    constraint.p1 = this;
    constraint.p2 = point;
    constraint.cp = cp;
    constraint.length = Math.sqrt(diff_x * diff_x + diff_y * diff_y);

    this.constraints.push(constraint);
  },
  addForce(x, y) {
    this.vx += x;
    this.vy += y;

    var round = 400;
    this.vx = Math.round(this.vx * round) / round;
    this.vy = Math.round(this.vy * round) / round;
  },
  pin(pinx, piny) {
    this.pin_x = pinx;
    this.pin_y = piny;
  }
};

const Constraint = {
  p1: null,
  p2: null,
  cp: null,
  length: 0,
  resolve() {
    const diff_x = this.p1.x - this.p2.x;
    const diff_y = this.p1.y - this.p2.y;
    const dist = Math.sqrt(diff_x * diff_x + diff_y * diff_y);
    const diff = (this.length - dist) / dist;

    const px = diff_x * diff * 0.5;
    const py = diff_y * diff * 0.5;

    this.p1.x += px;
    this.p1.y += py;
    this.p2.x -= px;
    this.p2.y -= py;
  },
  draw() {
    ctx.moveTo(this.p1.x, this.p1.y);

    this.cp
      ? ctx.quadraticCurveTo(this.cp.x, this.cp.y, this.p2.x, this.p2.y)
      : ctx.lineTo(this.p2.x, this.p2.y);
  }
};

const Web = {
  points: [],
  init: function init() {
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const angle = Math.PI / 4;

    for (let y = 0; y <= Settings.W; y++) {
      for (let x = 1 % (y + 1); x <= Settings.Y; x++) {
        const point = Object.create(Point);

        point.init(
          centerX + x * Settings.spacing * Math.cos(y * angle),
          centerY + x * Settings.spacing * Math.sin(y * angle)
        );

        x > 0 && point.attach(this.points[(this.points.length - 1) * (1 % x)]);
        x >= Settings.Y && point.pin(point.x, point.y);

        if (y > 0 && x < Settings.Y) {
          const controlPoint = Object.create(Point);

          controlPoint.init(
            this.points[0].x +
              Settings.offset * x * Math.cos(y * angle - angle / 2),
            this.points[0].y +
              Settings.offset * x * Math.sin(y * angle - angle / 2)
          );

          point.attach(this.points[x + (y - 1) * Settings.Y], controlPoint);
        }

        if (y >= Settings.W && x < Settings.Y) {
          const controlPoint = Object.create(Point);

          controlPoint.init(
            this.points[0].x +
              Settings.offset * x * Math.cos(y * angle + angle / 2),
            this.points[0].y +
              Settings.offset * x * Math.sin(y * angle + angle / 2)
          );

          point.attach(
            this.points[x + (y - Settings.W) * Settings.Y],
            controlPoint
          );
        }

        this.points.push(point);
      }
    }

    return this;
  },
  draw() {
    ctx.beginPath();

    let i = this.points.length;
    while (i--) {
      const point = this.points[i];

      point.draw();
    }

    ctx.stroke();
  },
  update() {
    let i = Settings.physics_accuracy;

    while (i--) {
      var p = this.points.length;
      while (p--) this.points[p].resolve_constraints();
    }

    i = this.points.length;
    while (i--) this.points[i].update(0.016);
  }
};

function update() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  web.update();
  web.draw();

  requestAnimFrame(update);
}

function start() {
  canvas.onmousemove = function(e) {
    Mouse.px = Mouse.x;
    Mouse.py = Mouse.y;

    const rect = canvas.getBoundingClientRect();

    Mouse.x = e.clientX - rect.left;
    Mouse.y = e.clientY - rect.top;
    e.preventDefault();
  };

  canvas.oncontextmenu = function(e) {
    e.preventDefault();
  };

  boundsx = canvas.width - 1;
  boundsy = canvas.height - 1;

  web = Object.create(Web);

  ctx.strokeStyle = "#888";
  web.init().draw();

  update();
}

window.onload = function() {
  canvas = document.getElementById("canvas");
  ctx = canvas.getContext("2d");

  canvas.width = 560;
  canvas.height = 350;

  start();
};
