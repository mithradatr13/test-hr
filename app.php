<?php
use Swoole\Http\Request;
use Swoole\Http\Response;
use Swoole\WebSocket\Frame;
use Swoole\WebSocket\Server;
// use Dotenv\Dotenv;


require_once 'vendor/autoload.php';
use \Firebase\JWT\JWT;
$dotenv = Dotenv\Dotenv::createImmutable(__DIR__);
$dotenv->load();

// Access environment variables
$mongoUrl = $_ENV['MONGO_URL'];
$appPort = $_ENV['PORT_HTTP'];

$secret_key = 'your_secret_key';

$mongoClient = new MongoDB\Client($mongoUrl);
$usersCollection = $mongoClient->selectDatabase($_ENV['DATABASE_NAME'])->selectCollection('users');
$providersCollection = $mongoClient->selectDatabase($_ENV['DATABASE_NAME'])->selectCollection('providers');

$httpServer = new Swoole\Http\Server("0.0.0.0", $appPort);

$httpServer->on('start', function () {
    echo "Swoole HTTP server started at http:/localhost:9502\n";
    $userData = [
        "phone" => "09120000000",
        "password" => "123456"
    ];
    $userExists = checkUserExistence($userData['phone']);
    if (!$userExists) {
        createUser($userData);
        echo "User created successfully\n";
    } else {
        echo "User already exists\n";
    }

});
// API endpoints
$httpServer->on('request', function (Request $request, Response $response) use ($mongoClient, $usersCollection, $providersCollection, $secret_key) {


    $response->header("Content-Type", "application/json");
    $wsPort = $_ENV['PORT_WS'];
    $wsServer = new Server("0.0.0.0", $wsPort);

    $router = new \Swoole\Http\Router();

    $router->post('/api/login', function () use ($request, $response, $usersCollection, $secret_key) {
        $data = json_decode($request->rawContent(), true);

        $user = $usersCollection->findOne(['phone' => $data['phone'], 'password' => $data['password']]);

        if ($user) {
            $token = JWT::encode(['phone' => $data['phone']], $secret_key, 'HS256');
            $response->end(json_encode(['auth_token' => $token]));
            return;
        } else {
            $response->status(401);
            $response->end(json_encode(['error' => 'Invalid credentials']));
            return;
        }
    });

    $router->post('/api/provider/location/update', function () use ($request, $response, $providersCollection, $secret_key) {
        $data = json_decode($request->rawContent(), true);

        $jwt_token = $request->header['authorization'];
        $decoded = JWT::decode($jwt_token, $secret_key, ['HS256']);

        $provider_phone = $decoded->phone;

        $providersCollection->updateOne(
            ['phone' => $provider_phone],
            ['$set' => ['lat' => $data['lat'], 'lng' => $data['lng'], 'is_online' => $data['is_online']]]
        );

        $response->end(json_encode(['message' => 'Location and online status updated successfully']));
        return;
    });

    $router->get('/api/providers/nearby', function () use ($request, $response, $providersCollection) {
        $lat = $request->get['lat'];
        $lng = $request->get['lng'];

        $nearby_providers = $providersCollection->find([
            'lat' => ['$gte' => $lat - 0.01, '$lte' => $lat + 0.01],
            'lng' => ['$gte' => $lng - 0.01, '$lte' => $lng + 0.01],
            'is_online' => true
        ]);

        $response->end(json_encode(['status' => 'success', 'providers' => $nearby_providers->toArray()]));
        return;
    });

    $router->execute($request, $response);

    $wsServer->on('message', function (Server $server, Frame $frame) use ($wsServer, $providersCollection) {
        foreach ($server->connections as $fd) {
            $server->push($fd, $frame->data);
        }

        // Handle real-time notifications to all providers
        $providers = $providersCollection->find();
        foreach ($providers as $provider) {
            $server->push($provider['fd'], $frame->data);
        }
    });
    $wsServer->start();


});


function checkUserExistence($phone)
{
    $client = new MongoDB\Client($_ENV['MONGO_URL']);
    $collection = $client->selectDatabase($_ENV['DATABASE_NAME'])->selectCollection('users');
    $user = $collection->findOne(['phone' => $phone]);
    return ($user !== null);
}

function createUser($userData)
{
    $client = new MongoDB\Client($_ENV['MONGO_URL']);
    $collection = $client->selectDatabase($_ENV['DATABASE_NAME'])->selectCollection('users');
    $insertResult = $collection->insertOne($userData);
    if ($insertResult->getInsertedCount() === 1) {
        echo "User created with phone: {$userData['phone']} and password: {$userData['password']}\n";
    } else {
        echo "Failed to create user\n";
    }
}

$httpServer->start();

