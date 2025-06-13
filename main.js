class MineSweeper{
    constructor(mines, height, width){
        this.rootElm = document.getElementById('gameField');
        // 爆弾の数
        this.mines = mines;
        // 爆弾に立てられた旗の数(勝利フラグ)
        this.bombFlagCnt = 0;
        // フィールドの縦横設定
        this.height = height;
        this.width = width;
        // ゲーム中かどうかのフラグ
        // ready,playing,endedの3種類。
        // ready  ：ゲームスタートのクリック(爆弾の配置を伴う)を受け付ける。ダブルクリックや右クリックは受け付けない
        // playing：ゲームプレイ中の状態
        // ended  ：ゲーム終了後。何も受け付けない。readyに遷移する際、同時に盤面のリセットもすること
        this.gameStatus = 'ready'
        // gameStatusプロパティはGoogle Geminiに聞いたアイデアです

        this.createField();


        // イベントリスナーをセット
        // 左クリック、ダブルクリック、右クリックの順
        // 左クリック
        this.rootElm.addEventListener('click', (event) => {
            // ゲーム中は普通にクリックできる
            if (this.gameStatus === 'playing'){
                this.clickCell(event.target);
            }
            // ゲーム開始時のクリックだった場合、gameStatusをplayingに変更し、
            // 爆弾の設置を伴う処理を行います
            else if (this.gameStatus === 'ready'){
                this.gameStatus = 'playing'
                this.displayGameView(event.target);
            }
            // gameStatusがendedの場合は何もさせません
        });
        // ダブルクリック、右クリックはgameStatusがplayingの場合しか受け付けません
        this.rootElm.addEventListener('dblclick', (event) => {
            if (this.gameStatus === 'playing'){
                this.doubleClickCell(event.target);
            }
        });
        this.rootElm.addEventListener('contextmenu', (event) => {
            if (this.gameStatus === 'playing'){
                this.rightClickCell(event.target);
            }
        })

        // オプション周り
        // レベル(easyとかのやつ)が切り替わったら、高さや幅の値を更新します
        const optionsElm = document.getElementById('options');
        const levelSelector = optionsElm.querySelector('.levelSelector');
        levelSelector.addEventListener('change', () => {
            this.displayOptions();
            this.createField();
        });
        // 高さ、幅が書き換えられたらそれを反映させます
        const heightCustomerElm = optionsElm.querySelector('.height');
        const widthCustomerElm = optionsElm.querySelector('.width');
        const minesCustomerElm = optionsElm.querySelector('.mines');

        heightCustomerElm.addEventListener('change', () => {
            this.height = heightCustomerElm.value;
            // 盤面の描画しなおし
            this.createField();
        });
        widthCustomerElm.addEventListener('change', () => {
            this.width = widthCustomerElm.value;
            // 盤面の描画しなおし
            this.createField();
        });
        // 爆弾の数がプレイ不可能な数設定されている可能性があるのでチェック
        minesCustomerElm.addEventListener('change', () => {
            // 0個以下もしくはセルの総数-9より多い場合、
            // 1とか設置の限界数に調節します　それでもうまく動かないけど……
            const cellsLimit = this.height*this.width-9;
            if (minesCustomerElm.value  <= 0){
                minesCustomerElm.value = 1;
            }else if (cellsLimit < minesCustomerElm.value){
                minesCustomerElm.value = cellsLimit;
            }
        })
    }


    async init(){
        await this.fetchLevelData();
        this.displayOptions();
    }

    async fetchLevelData(){
        try{
            const response = await fetch('options.json');
            this.levelData = await response.json();
        }catch(e){
            this.rootElm.innerText = 'エラーが発生しました';
            console.log(e);
        }
    }

    // 座標を取得
    // [x, y]の形式で配列が返ってきます
    getCoordinate(className){
        // セルの座標を取得(クラス名からcellを削除、x-yの-で区切って配列に)
        return className.replace('cell', '').split('-');
    }

    // 左クリック
    clickCell(cell){
        // 爆弾でないかつまだオープンしていないセルをクリック
        if (cell.value === 'empty'){
            // 周囲の爆弾の数を表示
            this.displayNumberCell(cell);
            // オープンした結果、周囲に爆弾が無かった場合
            if (cell.innerText === '0'){
                // 座標を取得し、
                const coordinate = this.getCoordinate(cell.className);
                const x = parseInt(coordinate[0]);
                const y = parseInt(coordinate[1]);
                // 幅優先探索へ移行
                this.bfsCell(x, y);
            }
            this.isClear();
        }

        else if (cell.value === 'bomb'){
            this.displayGameOverView();
        }
    }

    doubleClickCell(cell){
        // オープン済みのセルをクリックした場合
        if (cell.value === 'opened'){
            this.allOpenCell(cell);
            this.isClear();
        }
    }

    // 右クリックしたとき
    rightClickCell(cell){
        if (cell.value === 'empty'){
            cell.value = 'flag-em';
            cell.innerText = '旗';
        }
        // 爆弾に立てられた旗を取ります
        else if (cell.value === 'flag-bo'){
            cell.value = 'bomb';
            cell.innerText = '';
            this.bombFlagCnt--;
        }
        else if (cell.value === 'flag-em'){
            cell.value = 'empty';
            cell.innerText = '';
        }
        // 爆弾に旗を立てる
        else if (cell.value === 'bomb'){
            cell.value = 'flag-bo';
            cell.innerText = '旗';
            this.bombFlagCnt++;
            // flag-boの数が爆弾の数と一致した場合
            // すべての爆弾に旗が立っていなくとも他の空白セルがすべてオープンされたなら勝利判定にしたいけど
            // さすがに後回しで……
        }
        this.isClear();
    }

    // すべての空白セルを開けた、かつすべての爆弾に旗を立てた場合勝利
    isClear(){
        if (this.bombFlagCnt === parseInt(this.mines) && 
            this.isOpenAllEmptyCell()){
            this.displayresultView();
        }
    }

    // すべての空白セルが開いているかを確認
    isOpenAllEmptyCell(){
        for (let y = 0; y < this.height; y++){
            for (let x = 0; x < this.width; x++){
                const currentCellELm = this.rootElm.querySelector(`.cell${x}-${y}`);
                if (currentCellELm.value === 'empty'){
                    return false;
                }
            }
        }
        return true;
    }

    // 空白セルのクリック時や
    // 周囲の爆弾に旗を立ててあるセルをダブルクリックしたときなど
    // 一括でオープンするとき用
    allOpenCell(cell){
        const coordinate = this.getCoordinate(cell.className);
        const x = parseInt(coordinate[0]);
        const y = parseInt(coordinate[1]);

        // まずは周囲の爆弾数と爆弾セルに立てられた旗の数が一致するかチェック
        const flagCheck = this.checkBombAndFlag(x, y);
        if (flagCheck === 'gameover'){
            this.displayGameOverView();
            return null;
        }
        else if (flagCheck === 'great'){
            // 幅優先探索で周囲に爆弾が無いセルをすべて開ける(がんばれ)
            this.bfsCell(x, y);
        }
    }

    // 周囲8マスのセルを取得
    getNearCells(x, y){
        x = parseInt(x);
        y = parseInt(y);
        const classNames = [];

        // x = i, y = j
        for (let j = -1; j < 2; j++){
            for (let i = -1; i < 2; i++){
                // 今いるセルはスキップ
                if (i === 0 && j === 0){
                    continue;
                }

                // 存在しない座標もスキップ
                if (x+i < 0 || y+j < 0 ||
                    x+i >= this.width || y+j >= this.height){
                        continue;
                    }

                classNames.push(`cell${x+i}-${y+j}`);
            }
        }
        return classNames;
    }

    // オープン時、セルに周囲の爆弾数を表示する
    displayNumberCell(cell){
        // 座標を取得
        const thisCellCoordinates = this.getCoordinate(cell.className);
        const x = parseInt(thisCellCoordinates[0]);
        const y = parseInt(thisCellCoordinates[1]);

        // 周囲のセルのクラス名を取得
        const classNames = this.getNearCells(x, y);
        
        let bombCnt = 0;
        for (const name of classNames){
            const currentCellValue = this.rootElm.querySelector(`.${name}`).value;
            // 爆弾セルだった場合はbombCntにインクリメント
            if (currentCellValue === 'bomb' || currentCellValue === 'flag-bo'){
                bombCnt++;
            }
        }

        // セルを開けたら
        cell.value = 'opened';
        // セルのstyleをいじくります
        cell.style.backgroundColor = 'rgb(240, 240, 240)';
        cell.innerText = bombCnt;
        cell.style.fontWeight = 'bold'; // 太字に
        
        if (0 <= bombCnt < 9){
            if (bombCnt === 0) {cell.style.color = 'rgb(240, 240, 240)';}
            else if (bombCnt === 1) {cell.style.color = 'rgb(37, 32, 173)';}
            else if (bombCnt === 2) {cell.style.color = 'rgb(138, 20, 97)';}
            else if (bombCnt === 3) {cell.style.color = 'rgb(138, 20, 24)';}
            else if (bombCnt === 4) {cell.style.color = 'rgb(138, 58, 9)';}
            else if (bombCnt === 5) {cell.style.color = 'rgb(167, 126, 3)';}
            else if (bombCnt === 6) {cell.style.color = 'rgb(75, 130, 7)';}
            else if (bombCnt === 7) {cell.style.color = 'rgb(13, 85, 136)';}
            else if (bombCnt === 8) {cell.style.color = 'rgb(255, 0, 0)';} // 虹色にしたかった……
        }
        
    }

    // 周囲の爆弾と旗の数が一致しているか、また、間違った旗が立てられていないかをチェックします
    // 返り値はboolean
    checkBombAndFlag(x, y){
        const nearCell = this.getNearCells(x, y);
        // 周囲の爆弾数(セルに表示されている数)
        const nearBombs = parseInt(this.rootElm.querySelector(`.cell${x}-${y}`).innerText);

        // 周囲の旗を調べます
        // この場合、爆弾が無いセルに旗を立てていた場合はどうするか迷い中
        // ↑の場合、ゲームオーバーとする方向で実装します

        const classNames = this.getNearCells(x, y);

        // 正しく立てられた旗の数
        let nearTrueFlagCnt = 0;
        // 間違った旗の数 1でもあればゲームオーバー
        let nearFalseFlagCnt = 0;

        for (const className of classNames){
            // 間違った旗がある
            if (this.rootElm.querySelector(`.${className}`).value === 'flag-em') nearFalseFlagCnt++;
            // 正しい旗がある
            else if (this.rootElm.querySelector(`.${className}`).value === 'flag-bo') nearTrueFlagCnt++;
        }

        // 間違った旗が立てられている、ゲームオーバー
        if (nearFalseFlagCnt > 0) return 'gameover';
        // 正しく旗が立てられている、ゲーム続行
        else if (nearTrueFlagCnt === nearBombs) return 'great';
        // 間違った旗はないが、正しい旗が足りない
        else return 'none';
    }

    // 一括オープンのため幅優先探索をします
    bfsCell(x, y){
        // 移動用 [x, y]で表し、[0,-1]ならば真上のセルを示す
        // [0,-1]から時計回りで探索します
        const move = [[0,-1],[1,-1],[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1]]

        // 幅優先なので、qへの追加はpush、取り出しはshift(先頭から取得)
        const q = [[x, y]];
        // 冗長な書き方だけど見やすさ優先で……
        while (q.length > 0){
        //for (let i = 0; i < 8; i++){
            const currentCell = q.shift();
            // 周囲8マスのセルを開けます
            // 開けた周囲8マスの中にさらに周囲の爆弾0のセルが存在する場合、
            // qにそのセルの座標をpushする
            for (const m of move){
                const nextX = currentCell[0]+m[0];
                const nextY = currentCell[1]+m[1];
                const currentCellElm = this.rootElm.querySelector(`.cell${nextX}-${nextY}`);

                // 存在しないセルを見ている
                if (!currentCellElm){
                    continue;
                }
                // すでに旗が立っているため探索の必要が無い
                if (currentCellElm.value === 'flag-bo'){
                    continue;
                }
                // 探索済みのセル(value='opened')がある場合はスキップ
                if (currentCellElm.value === 'opened'){
                    continue;
                }
                // セルを開ける
                this.displayNumberCell(currentCellElm);
                // 開けたセルの周囲8マスに爆弾が無い場合は次の探索対象としてpush
                if (currentCellElm.innerText === '0'){
                    q.push([nextX, nextY]);
                }
            }
        }
    }

    // ボタンを描画
    displayButton(){
        // div要素、この中にbuttonが入ります
        const btnsDivElm = document.getElementById('btn');
        // gameStatusがreadyの場合は何もボタンがいらない
        if (this.gameStatus === 'ready'){
            btnsDivElm.innerHTML = '';
        }
        else{
            if (this.gameStatus === 'playing'){
                btnsDivElm.innerHTML = `
                    <button class = "button">途中終了</button>
                `;
            }
            else if (this.gameStatus === 'ended'){
                btnsDivElm.innerHTML = `
                    <button class = "button">もう一度</button>
                `;
            }
            const btnElm = btnsDivElm.querySelector('.button');
            
            btnElm.addEventListener('click', () => {
                if (this.gameStatus === 'playing'){
                    this.displayGameOverView();
                }
                else if (this.gameStatus === 'ended'){
                    this.createField();
                    this.gameStatus = 'ready';
                    this.displayButton();
                }
            });
        }
        this.displayOptions();
    }

    // オプション表示
    displayOptions(){
        const parentElm = document.getElementById('options');
        // mode = 難易度
        const modeElm = parentElm.querySelector('.levelSelector');
        const mode = modeElm.value;

        // それぞれの要素を持ってくる
        const heightCustomer = parentElm.querySelector('.height');
        const widthCustomer = parentElm.querySelector('.width');
        const minesCustomer = parentElm.querySelector('.mines');

        // 難易度に応じた設定を自動で出力
        heightCustomer.value = this.levelData[mode].height;
        widthCustomer.value = this.levelData[mode].width;
        minesCustomer.value = this.levelData[mode].mines;

        // gameStatus = 'ready'の場合以外は入力を受け付けない
        if (this.gameStatus === 'playing' || this.gameStatus === 'ended'){
            modeElm.disabled = true;
            heightCustomer.disabled = true;
            widthCustomer.disabled = true;
            minesCustomer.disabled = true;
        }
        else if (this.gameStatus === 'ready'){
            modeElm.disabled = false;
            heightCustomer.disabled = false;
            widthCustomer.disabled = false;
            minesCustomer.disabled = false;
        }

        // プロパティにも反映
        this.height = this.levelData[mode].height;
        this.width = this.levelData[mode].width;
        this.mines = this.levelData[mode].mines;
    }

    // ゲーム開始
    displayGameView(target){
        this.bombFlagCnt = 0;

        // 爆弾の数を決定
        const optionsElm = document.getElementById('options');
        this.mines = optionsElm.querySelector('.mines').value;
        this.setMine(target);
        const coordinate = this.getCoordinate(target.className);
        const x = parseInt(coordinate[0]);
        const y = parseInt(coordinate[1]);
        this.bfsCell(x, y);
        
        this.displayButton();
    }

    // ゲーム終了に関する設定

    // ゲームクリア
    displayresultView(){
        this.gameStatus = 'ended';
        this.displayButton();
    }

    // ゲームオーバー
    displayGameOverView(){
        this.gameStatus = 'ended';
        for (let y = 0; y < this.height; y++){
            for (let x = 0; x < this.width; x++){
                const currentCellELm = this.rootElm.querySelector(`.cell${x}-${y}`);
                if (currentCellELm.value === 'bomb' || currentCellELm.value ===  'flag-bo'){
                    currentCellELm.innerText = '爆';
                }
            }
        }
        this.displayButton();
    }

    // フィールドを作ります(作るだけ)
    // 爆弾の設置は最初のクリックの直後、即ゲームオーバーを回避します
    createField(){
        const tbodyElm = document.getElementById('gameField');
        tbodyElm.innerHTML = '';

        // 行
        for (let y = 0; y < this.height; y++){
            const row = document.createElement('tr');
            // 列
            for (let x = 0; x < this.width; x++){
                const tdElm = document.createElement('td');

                // 座標を「x, y」の形の文字列に
                const c = `${x},${y}`;

                tdElm.className = `cell${x}-${y}`;

                row.appendChild(tdElm);
            }
            tbodyElm.appendChild(row);
        }
    }

    // 爆弾のセットをします
    // 最初にクリックしたセル(target)と周囲8マスには爆弾を出現させないように
    setMine(target){
        const startCell = this.getCoordinate(target.className);
        const minesCoordinates = this.decideMinesCoordinate(startCell); // 爆弾の座標
        for (let j = 0; j < this.height; j++){
            for (let i = 0; i < this.width; i++){
                const currentCellElm = this.rootElm.querySelector(`.cell${i}-${j}`);

                // 座標を「x, y」の形の文字列に
                const c = `${i},${j}`;

                // 爆弾のセット
                // 今の座標が爆弾のある場所なら
                if (minesCoordinates.indexOf(c) >= 0){
                    currentCellElm.value = 'bomb';
                }
                else{
                    currentCellElm.value = "empty";
                }
            }
        }
    }

    // 爆弾をセットする座標を決めます
    // 引数は(爆弾の数、セルの数)
    decideMinesCoordinate(startCell){
        const coordinates = []; // 爆弾の座標を格納する
        // 爆弾をセットしてはいけないマスを設定
        const dontPutBomb = []
        const currentX = parseInt(startCell[0]);
        const currentY = parseInt(startCell[1]);
        for (let y = -1; y < 2; y++){
            for (let x = -1; x < 2; x++){
                dontPutBomb.push(`${currentX+x},${currentY+y}`);
            }
        }

        for (let i = 0; i < this.mines; i++){
            const x = Math.floor(Math.random() * this.width);
            const y = Math.floor(Math.random() * this.height);
            const c = x+","+y
            if (coordinates.indexOf(c)>=0){
                i--;
                continue;
            }
            if (dontPutBomb.indexOf(c)>=0){
                i--;
                continue;
            }
            coordinates.push(c);
        }
        return coordinates;
    }

}

rootElm = document.getElementById('gameField');
new MineSweeper(15, 10, 10).init();