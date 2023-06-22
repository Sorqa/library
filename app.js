const express = require('express')
const ejs = require('ejs') 
const port = 3000;
const xlsx = require('xlsx');
var bodyParser = require('body-parser')
var session = require('express-session')
const path = require('path');
const http= require('http');
const socketIO= require('socket.io');
const winston = require('winston');
const app = express()
const server = http.createServer(app);
const io = socketIO(server);
require('dotenv').config()

//mysql DB값과 연결
const mysql = require('mysql2')
const connection = mysql.createConnection(process.env.DATABASE_URL)
console.log('Connected to PlanetScale!')


//문의 내용에서 등록일의 현재 시간을 한국시간으로 설정 
connection.query("SET time_zone='Asia/Seoul'");

//express 설정
app.set('view engine', 'ejs')
app.set('views', './views')
app.use(express.static(__dirname + '/public'));


app.use(bodyParser.urlencoded({extended:false}))
//이미지 삽입 하기 위해 미들웨어 추가
app.use(express.static(__dirname+'/public')) 
//secret은 hash 문자열, 나만 알 수 있는 고유한 문자열 입력
app.use(session({ secret: 'skutree', cookie: { maxAge: 60000000 }, resave:true, saveUninitialized:true }))
//모든 페이지에서 로그인 값을 사용할 수 있게 함.
app.use((req, res, next) => {    
  //변수 정의
  res.locals.user_id = "";
  res.locals.name = "";
  //변수값 재할당
  if(req.session.admin){ 
     res.locals.user_id = req.session.admin.user_id //res.locals 변수를 서로 공유할 수 있음.
     res.locals.name = req.session.admin.name 
  }
  next()
})

// 소켓 서버 이벤트 처리
io.on('connection', socket => {
  console.log('새로운 클라이언트가 연결되었습니다.');

  socket.on('message', data => {
    console.log('메시지를 받았습니다:', data);
    io.emit('message', data); // 받은 메시지를 모든 클라이언트에게 전달
  });

  socket.on('disconnect', () => {
    console.log('클라이언트가 연결이 종료되었습니다.');
  });
});

//라우팅
app.get('/', (req, res) => {
  console.log(req.session.admin); //홈에 로그인 값 저장
  // ./views/index.ejs
  logger.info('GET /3000 304 "홈으로 이동"'); 
  res.render('index') //include하면 내용 수정해도 노드를 재실행 안해줘도 됨.(새로고침)
})



for (let i = 1; i <= 20; i++) {
  app.get(`/popup${i}`, (req, res) => {
    logger.info(`GET /popup${i} 304 "popup${i}로 이동"`);
    res.render(`popup/popup${i}`);
  });
}

app.get('/search', (req, res) => {
  logger.info('GET /serach 304 "검색화면으로 이동"'); 
  res.render('search') 
})

app.get('/map', (req, res) => {
  logger.info('GET /map 304 "찾아오시는 길로 이동"'); 
  res.render('map') 
})

app.get('/contact', (req, res) => {
    logger.info('GET /contact 304 "문의하기로 이동"'); 
    res.render('contact') 
})

app.get('/admin', (req, res) => {
  logger.info('GET /admin 304 "회원가입으로 이동"'); 
  res.render('admin') 
})
// 팝업 핸들러 함수
function showPopup(req, res, popupNumber) {
  logger.info(`GET /popup${popupNumber} 304 "popup${popupNumber}로 이동"`);
  res.render(`popup${popupNumber}`);
}

// 팝업 라우팅
for (let i = 1; i <= 20; i++) {
  app.get(`/popup${i}`, (req, res) => showPopup(req, res, i));
}
//사용자용 문의하기
app.post('/contactProc', async (req, res) => {
  try {
    const name = req.body.name;
    const phone = req.body.phone;
    const email = req.body.email;
    const memo = req.body.memo;

    var sql = `insert into contact(name,phone,email,memo,regdate) values(?,?,?,?,now())`;

    var values = [name, phone, email, memo];

    await new Promise((resolve, reject) => {
      connection.query(sql, values, function (err, result) {
        if (err) reject(err);
        else resolve(result);
      });
    });
    res.send("<script> alert('문의사항이 등록되었습니다.'); location.href='/contactList';</script>");
    console.log('자료 1개를 삽입하였습니다.');
 } catch (err) {
    console.error('문의 등록 중 오류 발생:', err);
    res.sendStatus(500);
  }
});

// 문의 내용 삭제하기
app.get('/contactDelete', async (req, res) => {
  try {
    const idx = req.query.idx; // 쿼리의 idx 값을 변수 idx로 할당
    const sql = `DELETE FROM contact WHERE idx='${idx}'`; // 게시물의 고유한 idx 값을 받아서 해당 게시물 삭제

    await new Promise((resolve, reject) => {
      connection.query(sql, function (err, result) {
        if (err) reject(err);
        else resolve(result);
      });
    });

    logger.info('GET /contactList 304 "문의 삭제되었으므로 문의내용보기로 이동"');
    res.send("<script> alert('삭제되었습니다.'); location.href='/contactList';</script>");
  } catch (error) {
    logger.error('문의 삭제 중 오류 발생:', error);
    res.sendStatus(500);
  }
});

// 문의 내용보기
app.get('/contactList', async (req, res) => {
  try {
    logger.info('GET /contactList 304 "문의내용보기로 이동"');
    const sql = `SELECT * FROM contact ORDER BY idx DESC`; // 최근 문의 내용이 위로 오도록 함.

    const results = await new Promise((resolve, reject) => {
      connection.query(sql, function (err, results, fields) {
        if (err) reject(err);
        else resolve(results);
      });
    });
    res.render('contactList', { lists: results }); // 리스트로 문의하기 내용 전달
  } catch (error) {
    logger.error('문의 내용 조회 중 오류 발생:', error);
    res.sendStatus(500);
  }
});

// 로그 설정
const logger = winston.createLogger({
  level: 'info', // 로그 레벨을 'info'로 설정
  format: winston.format.json(), // 로그 형식을 JSON으로 설정
  transports: [
    new winston.transports.Console(), // 콘솔 출력 설정
    new winston.transports.File({ filename: 'logs.log' }) // 파일 출력 설정
  ]
});
// 로그인 기능 구현
app.get('/login', async (req, res) => {
  try {
    logger.info('GET /login 304 "로그인 화면으로 이동"'); // 로그 기록
    res.render('login');
  } catch (error) {
    logger.error('로그인 화면 이동 중 오류 발생:', error);
    res.sendStatus(500);
  }
});

app.post('/loginProc', async (req, res) => {
  try {
    const user_id = req.body.user_id;
    const pw = req.body.pw;

    const sql = `select * from admin where user_id=? and pw=?`; // 값이 입력됐는지 확인
    const values = [user_id, pw];

    const result = await new Promise((resolve, reject) => {
      connection.query(sql, values, function (err, result) {
        if (err) reject(err);
        else resolve(result);
      });
    });

    if (result.length == 0) {
      res.send("<script> alert('존재하지 않는 아이디입니다.'); location.href='/login';</script>");
    } else {
      console.log(result[0]); // 로그인 값 콘솔창에 출력
      req.session.admin = result[0]; // 세션으로 로그인 값 저장
      res.cookie('user_id', user_id); // 쿠키 설정
      logger.info('로그인 성공'); // 로그 기록
      res.send("<script> alert('로그인 되었습니다.'); location.href='/';</script>"); // 로그인 되었다는 알림 뜨고, 홈으로 다시 이동
    }
  } catch (error) {
    logger.error('로그인 처리 중 오류 발생:', error);
    res.sendStatus(500);
  }
});

app.get('/logout', async (req, res) => {
  try {
    req.session.admin = null;
    res.cookie('user_id', '', { expires: new Date(0) }); // 쿠키 설정 (유효 기간을 과거로 설정하여 쿠키를 만료시킴)
    logger.info('로그아웃'); // 로그 기록
    res.send("<script> alert('로그아웃 되었습니다.'); location.href='/';</script>");
  } catch (error) {
    logger.error('로그아웃 처리 중 오류 발생:', error);
    res.sendStatus(500);
  }
});

app.post('/adminProc', async (req, res) => {
  try {
    const name = req.body.name;
    const user_id = req.body.user_id;
    const pw = req.body.pw;
    const email = req.body.email;
    const phone = req.body.phone;

    const sql = `insert into admin(name, user_id, pw, email, phone) values(?,?,?,?,?)`;
    const values = [name, user_id, pw, email, phone];

    await new Promise((resolve, reject) => {
      connection.query(sql, values, function (err, result) {
        if (err) reject(err);
        else resolve(result);
      });
    });

    res.send("<script> alert('가입해주셔서 감사합니다.'); location.href='/login';</script>");
  } catch (error) {
    logger.error('회원가입 처리 중 오류 발생:', error);
    res.json({ success: false, message: '회원가입 처리 중 오류가 발생했습니다.' });
  }
});

// 엑셀 파일 경로
const excelFilePath = './books.xlsx';

// 책 목록을 가져오는 함수
async function getBookList() {
  const workbook = await xlsx.readFile(excelFilePath);
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const bookList = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
  return bookList;
}

// 책 검색 함수
async function searchBooks(keyword) {
  const bookList = await getBookList();
  const filteredBooks = bookList.filter(book => {
    const title = book[0] || '';
    const author = book[1] || '';
    return title.toLowerCase().includes(keyword.toLowerCase()) || author.toLowerCase().includes(keyword.toLowerCase());
  });
  return filteredBooks.map(book => ({
    title: book[0],
    author: book[1],
    publisher: book[2],
    genre: book[3],
    availability: book[4],
    location: book[5],
    summary: book[6],
    number: book[7]
  }));
}

app.get('/books/search', async (req, res) => {
  const keyword = req.query.keyword;
  const searchResult = await searchBooks(keyword);
  res.json(searchResult);
});


// 미들웨어 설정
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());


// 정적 파일 제공
app.use(express.static('public'));

// 대출 처리
async function borrowBook(bookId) {
  const bookList = await getBookList();
  const book = bookList[bookId - 1];

  if (book) {
    // 이미 대출 중인 경우
    if (book[4] === 'Y') {
      console.log('이미 대출 중인 책입니다.');
    } else {
      // 대출 처리
      book[4] = 'Y'; // 대출 여부를 'Y'로 변경

      console.log('대출 진행중');

      const workbook = await xlsx.readFile(excelFilePath);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      worksheet['E' + book[7]].v = 'Y';

      await xlsx.writeFile(workbook, excelFilePath);
      console.log('대출이 완료되었습니다.');
    }
  } else {
    console.log('해당하는 책이 없습니다.');
  }
}

// 반납 처리
async function returnBook(bookId) {
  const bookList = await getBookList();
  const book = bookList[bookId - 1];

  if (book) {
    // 이미 대출 중인 경우
    if (book[4] === 'N') {
      console.log('이미 반납된 책입니다.');
    } else {
      // 대출 처리
      book[4] = 'N'; // 대출 여부를 'N'로 변경

      console.log('반납 진행중');

      const workbook = await xlsx.readFile(excelFilePath);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      worksheet['E' + book[7]].v = 'N';

      await xlsx.writeFile(workbook, excelFilePath);
      console.log('반납이 완료되었습니다.');
    }
  } else {
    console.log('해당하는 책이 없습니다.');
  }
}

// 대출 요청 처리
app.post('/books/borrowbook', async function (req, res) {
  const booknum = req.body.number;
  await borrowBook(booknum);

  const responseMessage = '대출이 완료되었습니다';
  res.send(responseMessage);
});

// 반납 요청 처리
app.post('/books/returnbook', async function (req, res) {
  const booknum = req.body.number;
  await returnBook(booknum);

  const responseMessage = '반납이 완료되었습니다';
  res.send(responseMessage);
});

app.listen(port, () => {
  console.log(`서버가 실행되었습니다. 접속주소: http://localhost:${port}`)
})