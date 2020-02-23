const area = require("./markedSquare");

let START_TIME;
let RUN_TIMER;

const NUMBER_IMAGES = [
  null,
  ...[...Array(8)].map((n, i) => renderImage(i + 1)),
  $image("staroflife.fill")
];

function renderImage(num) {
  const colors = {
    1: "blue",
    2: "#006400",
    3: "red",
    4: "purple",
    5: "orange",
    6: "#F0E68C",
    7: "cyan",
    8: "black"
  };
  const image = $imagekit.render({ size: $size(100, 100) }, ctx => {
    ctx.drawText($rect(20, 0, 60, 100), num.toString(), {
      color: $color(colors[num]),
      font: $font("menlo", 95)
    });
  });
  return image;
}

function buildStruct({ mines, columns, rows, selectedIndex = 0 }) {
  let blocks;
  let flag = true;
  do {
    blocks = area(columns, rows, mines);
    if (blocks.flat()[selectedIndex] !== 9) flag = false;
  } while (flag);

  const struct = blocks.flat().map((n, i) => {
    return {
      column: i % columns,
      row: parseInt(i / columns),
      number: n,
      flagSet: false,
      demined: false,
      index: i
    };
  });
  return struct;
}

function getData(struct) {
  return struct.map(n => {
    return {
      background: {
        bgcolor: n.demined ? $color("#ddf") : $color("blue")
      },
      mine_image: {
        image: NUMBER_IMAGES[n.number],
        hidden: n.demined ? false : true
      },
      flag_image: {
        hidden: n.flagSet ? false : true
      },
      column: n.column,
      row: n.row,
      number: n.number,
      flagSet: n.flagSet,
      demined: n.demined,
      index: n.index
    };
  });
}

function updateStruct({ struct, index, type = "mine" }) {
  if (type === "flag") {
    if (!struct[index].demined) {
      struct[index].flagSet = !struct[index].flagSet;
    }
  } else if (type === "mine") {
    if (!struct[index].demined) {
      struct[index].demined = true;
      struct[index].flagSet = false;
    }
  }
}

function roundClick({ struct, index }) {
  const column = struct[index].column
  const row = struct[index].row
  const surroundedBlocks = struct.filter(n => {
    if (
      n.column >= column - 1 &&
      n.column <= column + 1 &&
      n.row >= row - 1 &&
      n.row <= row + 1 &&
      !n.demined
    ) {
      return true;
    }
  });
  struct[index].demined = true;
  struct[index].flagSet = false;
  for (let i of surroundedBlocks) {
    if (i.number === 0) {
      roundClick({ struct, index: i.index})
    } else {
      updateStruct({ struct, index: i.index })
    }
  }
  
}

function defineMatrix({ mines, columns, rows }) {
  const width = Math.floor($device.info.screen.width / columns) * columns;
  const height = (width / columns) * rows;
  let struct;
  let gameStarted = false;
  const matrix = {
    type: "matrix",
    props: {
      id: "matrix",
      square: true,
      spacing: 0,
      columns,
      scrollEnabled: false,
      data: getData(Array(columns * rows).fill({})),
      template: {
        props: {
          borderWidth: 1
        },
        views: [
          {
            type: "view",
            props: {
              id: "background"
            },
            layout: $layout.fill
          },
          {
            type: "image",
            props: {
              id: "mine_image"
            },
            layout: $layout.fill
          },
          {
            type: "image",
            props: {
              id: "flag_image",
              tintColor: $color("#b00"),
              symbol: "flag.fill"
            },
            layout: $layout.fill
          }
        ]
      }
    },
    layout: (make, view) => {
      make.center.equalTo(view.super);
      make.size.equalTo($size(width, height));
    },
    events: {
      didSelect: function(sender, indexPath, data) {
        if (!gameStarted) {
          struct = buildStruct({
            mines,
            columns,
            rows,
            selectedIndex: indexPath.item
          });
          data = getData(struct)[indexPath.item]
          gameStarted = true;
          START_TIME = new Date().getTime();
          RUN_TIMER = true;
        }
        if (data.demined) return;
        if (data.flagSet) return;
        console.log(data)
        if (data.number === 9) {
          showAllMines(indexPath.item);
          finish(false);
        } else if (data.number === 0) {
          roundClick({
            struct,
            index: indexPath.item,
            column: data.column,
            row: data.row,
            columns,
            rows
          });
          sender.data = getData(struct);
          updateCounter();
          checkWin(mines);
        } else {
          updateStruct({ struct, index: indexPath.item, type: "mine" });
          sender.data = getData(struct);
          updateCounter();
          checkWin(mines);
        }
      },
      didLongPress: function(sender, indexPath, data) {
        if (!gameStarted) return;
        if (data.demined) return;
        updateStruct({ struct, index: indexPath.item, type: "flag" });
        sender.data = getData(struct);
        updateCounter();
      }
    }
  };
  return matrix;
}

function defineTimer() {
  const label = {
    type: "label",
    props: {
      id: "timer",
      bgcolor: $color("#eee"),
      align: $align.center,
      text: "用时：0"
    },
    layout: (make, view) => {
      make.size.equalTo($size(150, 50));
      make.bottom.equalTo($("matrix").top).inset(5);
      make.centerX.equalTo(view.super).multipliedBy(2 / 3);
    },
    events: {
      ready: sender => {
        setInterval(() => {
          if (START_TIME && RUN_TIMER) {
            sender.text =
              "用时：" + Math.floor((new Date().getTime() - START_TIME) / 1000);
          }
        }, 100);
      }
    }
  };
  return label;
}

function defineCounter(mines) {
  const label = {
    type: "label",
    props: {
      id: "counter",
      bgcolor: $color("#eee"),
      align: $align.center,
      text: "剩余：" + mines,
      info: {
        initial_mines: mines
      }
    },
    layout: (make, view) => {
      make.size.equalTo($size(150, 50));
      make.bottom.equalTo($("matrix").top).inset(5);
      make.centerX.equalTo(view.super).multipliedBy(4 / 3);
    },
    events: {}
  };
  return label;
}

function checkWin(mineNumber) {
  const data = $("matrix").data;
  const blockNumber = data.length;
  const deminedNumber = data.filter(n => n.demined).length;
  if (deminedNumber + mineNumber === blockNumber) finish();
}

function finish(win = true) {
  RUN_TIMER = false;
  $ui.alert({
    title: win ? "你赢了！" : "你输了！",
    actions: [
      {
        title: "退出",
        handler: function() {
          $app.close();
        }
      },
      {
        title: "再来一局",
        handler: function() {
          $addin.restart();
        }
      }
    ]
  });
}

function updateCounter() {
  const data = $("matrix").data;
  const flagNumber = data.filter(n => n.flagSet).length;
  const counter = $("counter");
  const initial_mines = counter.info.initial_mines;
  counter.text = "剩余：" + Math.max(initial_mines - flagNumber, 0);
}

function showAllMines(selectedIndex) {
  const data = $("matrix").data;
  data.forEach(n => {
    if (n.number === 9) {
      n.flag_image.hidden = true;
      n.mine_image.hidden = false;
    }
  });
  data[selectedIndex].background.bgcolor = $color("red");
  $("matrix").data = data;
}

function init() {
  $ui.render({
    props: {
      title: "扫雷"
    }
  });
  $delay(0.3, () => {
    $ui.menu({
      items: ["初级", "中级", "高级"],
      handler: (title, idx) => {
        let mines, columns, rows;
        switch (idx) {
          case 0: {
            mines = 10;
            columns = 8;
            rows = 8;
            break;
          }
          case 1: {
            mines = 25;
            columns = 12;
            rows = 12;
            break;
          }
          case 2: {
            mines = 35;
            columns = 12;
            rows = 12;
            break;
          }
          default:
            break;
        }
        const matrix = defineMatrix({ mines, columns, rows });
        $ui.window.add(matrix);
        const timer = defineTimer();
        $ui.window.add(timer);
        const counter = defineCounter(mines);
        $ui.window.add(counter);
      }
    });
  });
}

module.exports = {
  init
};
