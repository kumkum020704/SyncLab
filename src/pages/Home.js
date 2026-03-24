import React, { useState } from 'react';
import { v4 as uuidV4 } from 'uuid';
import toast from 'react-hot-toast';
import { Link, useNavigate } from 'react-router-dom';

const Home = () => {
    const navigate = useNavigate();

    const [roomId, setRoomId] = useState('');
    const [username, setUsername] = useState('');

    const createNewRoom = (e) => {
        e.preventDefault();
        const id = uuidV4();
        setRoomId(id);
        toast.success('New room created successfully');
    };

    const joinRoom = () => {
        if (!roomId || !username) {
            toast.error('Room ID and username are required');
            return;
        }

        navigate(`/editor/${roomId}`, {
            state: {
                username,
            },
        });
    };

    const handleInputEnter = (e) => {
        if (e.code === 'Enter') {
            joinRoom();
        }
    };

    return (
        <div className="homePageWrapper">
            <div className="formWrapper">
                <div style={{ textAlign: 'center', marginBottom: '22px' }}>
                    <h1
                        style={{
                            color: '#4AED88',
                            marginBottom: '8px',
                            fontSize: '42px',
                            fontWeight: '700',
                            letterSpacing: '1px',
                        }}
                    >
                        SyncLab
                    </h1>

                    <p
                        style={{
                            color: '#bdbdbd',
                            margin: 0,
                            fontSize: '15px',
                        }}
                    >
                        Code together in real-time with your team
                    </p>
                </div>

                <h4
                    className="mainLabel"
                    style={{
                        textAlign: 'center',
                        marginBottom: '18px',
                        fontSize: '24px',
                        lineHeight: '1.4',
                    }}
                >
                    Create a coding room or join an existing session
                </h4>

                <div className="inputGroup">
                    <input
                        type="text"
                        className="inputBox"
                        placeholder="Enter Room ID"
                        onChange={(e) => setRoomId(e.target.value)}
                        value={roomId}
                        onKeyUp={handleInputEnter}
                    />

                    <input
                        type="text"
                        className="inputBox"
                        placeholder="Enter Username"
                        onChange={(e) => setUsername(e.target.value)}
                        value={username}
                        onKeyUp={handleInputEnter}
                    />

                    <button
                        className="btn joinBtn"
                        onClick={joinRoom}
                        style={{ marginTop: '10px' }}
                    >
                        Join Room
                    </button>

                    <span
                        className="createInfo"
                        style={{
                            display: 'block',
                            textAlign: 'center',
                            marginTop: '18px',
                            fontSize: '18px',
                        }}
                    >
                        Don&apos;t have a room?{' '}
                        <Link
                            onClick={createNewRoom}
                            to="/"
                            className="createNewBtn"
                        >
                            Create New Room
                        </Link>
                    </span>
                </div>
            </div>

            <footer>
                <h4>
                    Built with ❤️ by{' '}
                    <a
                        href="https://github.com/kumkum020704"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: '#4AED88', textDecoration: 'none' }}
                    >
                        Kumkum
                    </a>
                </h4>
            </footer>
        </div>
    );
};

export default Home;