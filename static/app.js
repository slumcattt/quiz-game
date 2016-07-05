// ----- Dependencies ----- //

var socket = io();


// ----- Setup ----- //

var main = document.getElementsByTagName('main')[0];
var header = document.getElementsByTagName('header')[0];


// ----- Models ----- //

// Constructor for the user.
var user = (function User () {

	// ----- Properties ----- //

	var type = m.prop();
	var name = m.prop();
	var answer = m.prop();

	// ----- Functions ----- //

	// Sets the user to a given type.
	function setUser (userType, username) {

		if (userType === 'host') {
			username = 'Host';
		} else if (userType === 'screen') {
			username = 'Screen';
		}

		console.log(username);

		type(userType);
		name(username);
		var previous = localStorage.userID;

		var info = { type: userType, previous: previous, name: username };
		socket.emit('add-user', info);

	}

	// Saves the user name and ID.
	function saveUser () {

		localStorage.userID = `/#${socket.id}`;
		localStorage.userName = name();

	}

	// ----- Constructor ----- //

	return {
		set: setUser,
		save: saveUser,
		name: name,
		type: type,
		answer: answer
	};

})();

// Model to manage the current state of the game.
var game = (function Game () {

	// ----- Properties ----- //

	var category = m.prop();
	var question = m.prop();
	var points = m.prop();
	var users = m.prop([]);
	var playersSubmitted = m.prop([]);
	var scores = {};

	// ----- Functions ----- //

	// Emits the begin event.
	function emitBegin () {
		socket.emit('begin');
	}

	// Sets and emits the chosen category, or retrieves it.
	function accessCategory (newCategory) {

		if (newCategory) {

			category(newCategory);

			if (user.type() === 'host') {
				socket.emit('category-chosen', newCategory);
			}

		} else {
			return category();
		}
		
	}

	// Emits the start round event.
	function emitStartRound () {
		socket.emit('start-round');
	}

	// Sets the new question and points, or retrieves it.
	function accessQuestion (newQuestion) {

		if (newQuestion) {

			question(newQuestion);
			playersSubmitted([]);
			user.answer(null);
			points(newQuestion.a.length);

		} else {
			return question();
		}

	}

	// Stores a user's question score.
	function addScore (user, score) {

		var intScore = parseInt(score) || 0;
		var maxScore = points();

		if (intScore < 0) {
			scores[user] = 0;
		} else if (intScore > maxScore) {
			scores[user] = maxScore;
		} else {
			scores[user] = intScore;
		}

	}

	// Submits the user's answer.
	function submitAnswer () {

		playersSubmitted(playersSubmitted().concat(user.name()));
		socket.emit('submit-answer', user.answer());
		mountComponent(main, 'questionSubmitted');

	}

	// Submit's the host's given scores for each user.
	function submitScores () {
		socket.emit('scored', scores);
	}

	// Ends the game.
	function finish () {
		socket.emit('finish');
	}

	// ----- Constructor ----- //

	return {
		users: users,
		playersSubmitted: playersSubmitted,
		category: accessCategory,
		question: accessQuestion,
		points: points,
		saveAnswer: submitAnswer,
		saveScore: addScore,
		saveScores: submitScores,
		begin: emitBegin,
		startRound: emitStartRound,
		finish: finish
	};

})();


// ----- Components ----- //

// Mounts a component to a given location, with args.
function mountComponent (location, name, args, all) {

	var component = all ? components.all[name] : components[user.type()][name];

	m.mount(location, args ? m.component(component, args) : component);

}

// A set of components based upon user type.
var components = { host: {}, player: {}, screen: {}, all: {} };

// The page header.
components.all.head = {

	view: function (ctrl) {
		return m('h3', user.name());
	}

};

// The user type choice screen.
components.all.chooseUser = {

	controller: function () {
		return { user: user.set };
	},

	view: function (ctrl) {

		// Optionally gets a name and saves the user.
		function chooseUser (type) {

			if (type === 'player') {

				var userName = window.prompt('Enter a Username:',
					localStorage.userName);

				if (userName) {
					ctrl.user(type, userName);
				}

			} else {
				ctrl.user(type);
			}

		}

		return [
			m('button.choose-player', {
				onclick: function () { chooseUser('player'); }
			}, 'Player'),
			m('button.choose-host', {
				onclick: function () { chooseUser('host'); }
			}, 'Host'),
			m('button.choose-screen', {
				onclick: function () { chooseUser('screen'); }
			}, 'Screen')
		];

	}

};

components.host.gatheringPlayers = {

	controller: function () {
		return { begin: game.begin };
	},

	view: function (ctrl) {

		return [
			m('p', 'Gathering Players...'),
			m('button.begin', { onclick: ctrl.begin }, 'Begin')
		];

	}

};

components.screen.gatheringPlayers = {

	controller: function () {
		return { users: game.users };
	},

	view: function (ctrl) {

		return [
			m('p', 'Gathering Players...'),
			m('ul', ctrl.users().map(function (singleUser) {
				return m('li', singleUser);
			}))
		];

	}

};

components.player.gatheringPlayers = {

	view: function (ctrl) {
		return m('p', 'Gathering players...');
	}

};

components.host.chooseCategory = {

	controller: function (args) {
		return { category: game.category };
	},

	view: function (ctrl, args) {

		return args.categories.map(function (category) {

			return m('button', {
				onclick: function () { ctrl.category(category); }
			}, category);

		});

	}

};

components.screen.chooseCategory = {

	view: function (ctrl, args) {

		return m('ul', args.categories.map(function (category) {
			return m('li', category);
		}));

	}

};

components.player.chooseCategory = {

	view: function (ctrl) {
		return m('p', 'Category being chosen...');
	}

};

components.host.categoryInfo = {

	controller: function () {
		return { startRound: game.startRound, category: game.category };
	},

	view: function (ctrl) {

		return [
			m('p', ctrl.category()),
			m('button', { onclick: ctrl.startRound }, 'Start Round')
		];

	}

};

components.screen.categoryInfo = components.player.categoryInfo = {

	controller: function () {
		return { category: game.category };
	},

	view: function (ctrl) {
		return ('p', ctrl.category());
	}

};

components.host.question = {

	controller: function () {

		return {
			question: game.question,
			playersSubmitted: game.playersSubmitted
		};

	},

	view: function (ctrl) {

		return [
			m('p', ctrl.question().a),
			m('ul', ctrl.playersSubmitted().map(function (player) {
				return m('li', player);
			}))
		];

	}

};

components.screen.question = {

	controller: function () {
		return { question: game.question, points: game.points };
	},

	view: function (ctrl) {

		return [
			m('p', ctrl.question().q),
			m('p', `${ctrl.points()} point(s).`)
		];

	}

};

components.player.question = {

	controller: function () {

		return {
			question: game.question,
			answer: user.answer,
			submit: game.saveAnswer
		};

	},

	view: function (ctrl) {

		return [
			m('p', ctrl.question().q),
			m('input', { type: 'text', placeholder: 'Enter answer here...',
				onchange: m.withAttr('value', ctrl.answer) }),
			m('button', { onclick: ctrl.submit }, 'Submit')
		];

	}

};

components.player.questionSubmitted = {

	controller: function () {
		return { playersSubmitted: game.playersSubmitted };
	},

	view: function (ctrl) {

		return m('ul', ctrl.playersSubmitted().map(function (player) {
			return m('li', player);
		}));

	}

};

components.host.answers = {

	controller: function (args) {

		// Saves the scores to the game model.
		function scoresSubmit (event) {

			event.preventDefault();
			game.saveScores();

		}

		return { submit: scoresSubmit, score: game.saveScore };

	},

	view: function (ctrl, args) {

		// Produces a scoring input for a given answer.
		function answerScore (answer, answerNumber) {

			var id = `score-input-${answerNumber}`;

			return [
				m('label', { for: id }, answer.user.name),
				m('input', {
					id: id,
					type: 'number',
					onchange: m.withAttr('value',
						ctrl.score.bind(null, answer.user.id)
					)
				})
			];

		}

		return [
			m('form', { onsubmit: ctrl.submit }, [
				args.answers.map(answerScore),
				m('button[type="submit"', 'Score')
			])
		];

	}

};

components.screen.answers = {

	view: function (ctrl, args) {

		return args.answers.map(function (answer) {
			return [m('h3', answer.user.name), answer.answer];
		});

	}

};

components.player.answers = {

	controller: function () {
		return { question: game.question };
	},

	view: function (ctrl) {
		return ctrl.question().q;
	}

};

components.host.scores = {

	controller: function () {
		return { nextRound: game.begin, finish: game.finish };
	},

	view: function (ctrl) {

		return [
			m('button', { onclick: ctrl.nextRound }, 'Next Round'),
			m('button', { onclick: ctrl.finish }, 'Finish')
		];

	}

};

components.screen.scores = components.player.scores = {

	view: function (ctrl, args) {

		return args.scores.map(function (score) {
			return [m('h3', score.user), score.score];
		});

	}

};

components.all.winners = {

	view: function (ctrl, args) {

		if (args.winners.length > 1) {

			return [
				m('h2', 'The Winners Are:'),
				args.winners.map(function (winner) {
					return m('h3', winner.user);
				})
			];

		} else {
			return m('h2', `${args.winners[0].user} wins!`);
		}

	}

};


// ----- Socket Events ----- //

socket.on('err', function (err) {
	alert(err);
});

socket.on('client-disconnect', function (name) {
	alert(`Client disconnect: ${name}.`);
});

// Mounts the category view.
socket.on('category-view', function (categories) {
	mountComponent(main, 'chooseCategory', { categories: categories });
});

// Displays an error message when game fails to begin.
socket.on('begin-fail', function (msg) {
	alert(`Begin fail: ${msg}`);
});

// Saves the user's name when they are accepted.
socket.on('client-accepted', function () {

	user.save();
	mountComponent(main, 'gatheringPlayers');

});

socket.on('new-user', function (users) {

	game.users(users);
	m.redraw();

});

socket.on('host-exists', function () {
	alert('Host exists');
});

socket.on('show-category', function (category) {

	if (user.type() !== 'host') {
		game.category(category);
	}

	mountComponent(main, 'categoryInfo');

});

socket.on('scores-view', function (scores) {
	mountComponent(main, 'scores', { scores: scores });
});

socket.on('question-view', function (question) {

	game.question(question);
	mountComponent(main, 'question');

});

socket.on('answer-submitted', function (users) {

	game.playersSubmitted(users);
	m.redraw();

});

socket.on('answers-view', function (answers) {
	mountComponent(main, 'answers', { answers: answers });
});

socket.on('winners', function (winners) {
	mountComponent(main, 'chooseCategory', { winners: winners }, true);
});


// ----- Default Components ----- //

mountComponent(main, 'chooseUser', null, true);
mountComponent(header, 'head', null, true);
